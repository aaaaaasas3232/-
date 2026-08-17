/**
 * 天气 API 服务模块
 * 使用 Open-Meteo API（免费、无需API密钥、支持全球城市）
 * 
 * API 文档：https://open-meteo.com/en/docs
 * 地理编码：https://geocoding-api.open-meteo.com/v1/search
 * 空气质量：https://open-meteo.com/en/docs/air-quality-api
 */

// WMO Weather interpretation codes → 中文描述
// https://open-meteo.com/en/docs#weathervariables
const WMO_DESCRIPTIONS = {
    0: '晴',
    1: '晴间多云',
    2: '多云',
    3: '阴',
    45: '雾',
    48: '冻雾',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '米雪',
    80: '小阵雨',
    81: '阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '大阵雪',
    95: '雷阵雨',
    96: '雷阵雨伴小冰雹',
    99: '雷阵雨伴大冰雹',
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const RELATIVE_DAY_LABELS = ['今天', '明天', '后天'];
const WIND_DIR_LABELS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

// 弱网下 fetch 可能长时间不 settle，超时主动放弃，让 UI 能及时降级成「离线数据」
const REQUEST_TIMEOUT = 12 * 1000;
// 城市坐标几乎不变，搜索结果可以长缓存
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000;

const WeatherAPI = {
    // 城市名称到坐标的映射缓存
    _cityCache: new Map(),

    // 天气数据缓存（避免同一次交互里重复打同一个接口）
    _weatherCache: new Map(),
    _cacheExpiry: 5 * 60 * 1000, // 5分钟缓存

    /**
     * 搜索城市
     * @param {string} query - 城市名称
     * @returns {Promise<Array>} 城市列表
     * @throws {Error} 网络/接口异常时抛出，让调用方能区分「搜不到」和「网络挂了」
     */
    async searchCities(query) {
        const keyword = String(query || '').trim();
        if (!keyword) {
            return [];
        }

        const cacheKey = `search:${keyword}`;
        const cached = this._cityCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
            return cached.data;
        }

        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(keyword)}&count=10&language=zh&format=json`;
        const data = await this._fetchJson(url, '城市搜索');
        const cities = (data.results || []).map(city => ({
            name: city.name,
            country: city.country || '',
            countryCode: city.country_code || '',
            admin1: city.admin1 || '', // 省/州
            latitude: city.latitude,
            longitude: city.longitude,
            timezone: city.timezone || 'Asia/Shanghai',
            displayName: this._formatCityDisplay(city),
        }));

        // 空结果不进缓存：一次抖动不该把「查不到」钉死一整个会话
        if (cities.length) {
            this._cityCache.set(cacheKey, { data: cities, timestamp: Date.now() });
        }

        return cities;
    },

    /**
     * 格式化城市显示名称
     */
    _formatCityDisplay(city) {
        const parts = [city.name];
        if (city.admin1) parts.push(city.admin1);
        if (city.country) parts.push(city.country);
        return parts.join(', ');
    },

    /**
     * 带超时 + 明确错误文案的 fetch，避免上层拿到一个没头没尾的 TypeError
     */
    async _fetchJson(url, label) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT) : null;
        try {
            const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
            if (!response.ok) {
                throw new Error(`${label}失败（HTTP ${response.status}）`);
            }
            return await response.json();
        } catch (error) {
            if (error && error.name === 'AbortError') {
                throw new Error(`${label}超时，请检查网络`);
            }
            if (error instanceof TypeError) {
                throw new Error(`${label}失败，网络不可用`);
            }
            throw error;
        } finally {
            if (timer) clearTimeout(timer);
        }
    },

    /**
     * 获取真实天气数据
     * @param {string|Object} cityOrCoords - 城市名或坐标对象
     * @param {Object} [options] - { force: true 时跳过内存缓存，强制重新请求 }
     * @returns {Promise<Object>} 天气数据
     */
    async fetchWeather(cityOrCoords, options = {}) {
        let latitude, longitude, cityName, timezone;

        if (typeof cityOrCoords === 'object' && cityOrCoords.latitude !== undefined) {
            latitude = cityOrCoords.latitude;
            longitude = cityOrCoords.longitude;
            cityName = cityOrCoords.name || cityOrCoords.displayName || '未知';
            timezone = cityOrCoords.timezone || 'Asia/Shanghai';
        } else {
            // 字符串类型，尝试搜索城市
            const cities = await this.searchCities(cityOrCoords);
            if (cities.length === 0) {
                throw new Error(`未找到城市: ${cityOrCoords}`);
            }
            const city = cities[0];
            latitude = city.latitude;
            longitude = city.longitude;
            cityName = city.name;
            timezone = city.timezone;
        }

        const cacheKey = `weather:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
        if (!options.force) {
            const cached = this._weatherCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this._cacheExpiry) {
                return cached.data;
            }
        }

        // 空气质量是独立接口，挂了不该拖垮主天气
        const [forecastResult, airResult] = await Promise.allSettled([
            this._fetchForecast(latitude, longitude, timezone),
            this._fetchAirQuality(latitude, longitude, timezone),
        ]);

        if (forecastResult.status === 'rejected') {
            console.error('[WeatherAPI] 获取天气失败:', forecastResult.reason);
            throw forecastResult.reason;
        }
        if (airResult.status === 'rejected') {
            console.warn('[WeatherAPI] 获取空气质量失败（不影响天气）:', airResult.reason);
        }

        const weather = this._parseWeatherData(
            forecastResult.value,
            cityName,
            latitude,
            longitude,
            timezone,
            airResult.status === 'fulfilled' ? airResult.value : null,
        );

        this._weatherCache.set(cacheKey, {
            data: weather,
            timestamp: Date.now(),
        });

        return weather;
    },

    /**
     * 主天气接口：当前实况 + 逐小时 + 逐日
     */
    _fetchForecast(latitude, longitude, timezone) {
        const params = new URLSearchParams({
            latitude: latitude,
            longitude: longitude,
            timezone: timezone,
            current: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'precipitation',
                'weather_code',
                'cloud_cover',
                'wind_speed_10m',
                'wind_direction_10m',
                'is_day',
            ].join(','),
            hourly: [
                'temperature_2m',
                'relative_humidity_2m',
                'precipitation_probability',
                'weather_code',
                'is_day',
            ].join(','),
            daily: [
                'weather_code',
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_probability_max',
                'precipitation_sum',
                'sunrise',
                'sunset',
                'wind_speed_10m_max',
                'uv_index_max',
            ].join(','),
            forecast_days: 7,
        });

        return this._fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, '天气获取');
    },

    /**
     * 空气质量接口（独立域名，us_aqi 的分级与国标 AQI 一致，中文用户更熟悉）
     */
    async _fetchAirQuality(latitude, longitude, timezone) {
        const params = new URLSearchParams({
            latitude: latitude,
            longitude: longitude,
            timezone: timezone,
            current: ['us_aqi', 'pm2_5', 'pm10'].join(','),
        });
        const data = await this._fetchJson(
            `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`,
            '空气质量获取',
        );
        const value = data.current?.us_aqi;
        if (value === undefined || value === null) return null;
        return {
            aqi: Math.round(value),
            aqiLevel: this._mapAqiLevel(value),
            pm25: data.current?.pm2_5 ?? null,
            pm10: data.current?.pm10 ?? null,
        };
    },

    /**
     * 解析 Open-Meteo API 返回的数据
     */
    _parseWeatherData(data, cityName, latitude, longitude, timezone, air) {
        const current = data.current || {};
        const daily = data.daily || {};
        const hourly = data.hourly || {};

        const weatherCode = current.weather_code ?? null;
        const isDay = current.is_day === undefined ? null : current.is_day === 1;

        const todayHigh = daily.temperature_2m_max?.[0];
        const todayLow = daily.temperature_2m_min?.[0];

        // 逐日预报：每天都带上中文天气状况 + 降水概率 + 日出日落，
        // 让「每日阴晴」不只靠一个图标表达。
        const forecast = [];
        const dayCount = Math.min(7, daily.time?.length || 0);
        for (let i = 0; i < dayCount; i++) {
            const code = daily.weather_code?.[i] ?? null;
            forecast.push({
                date: daily.time?.[i] || '',
                day: this._formatDayLabel(daily.time?.[i], i),
                dateLabel: this._formatMonthDay(daily.time?.[i]),
                code,
                condition: this._mapWeatherCode(code),
                icon: this._mapIconKey(code, true),
                description: this._getWeatherDescription(code),
                high: this._round(daily.temperature_2m_max?.[i]),
                low: this._round(daily.temperature_2m_min?.[i]),
                pop: this._round(daily.precipitation_probability_max?.[i]),
                rainfall: daily.precipitation_sum?.[i] ?? null,
                windMax: this._round(daily.wind_speed_10m_max?.[i]),
                sunrise: this._formatClock(daily.sunrise?.[i]),
                sunset: this._formatClock(daily.sunset?.[i]),
                uv: this._round(daily.uv_index_max?.[i]),
            });
        }

        // 逐小时预报必须从「此刻」开始 —— Open-Meteo 的 hourly 数组是从当天 00:00 起排的，
        // 直接取前 N 条会让下午打开 App 的人看到一串已经过去的时间。
        const hourlyForecast = [];
        const startIndex = this._findCurrentHourIndex(hourly.time, current.time);
        const hourCount = hourly.time?.length || 0;
        for (let i = startIndex; i < Math.min(startIndex + 24, hourCount); i++) {
            const code = hourly.weather_code?.[i] ?? null;
            const hourIsDay = hourly.is_day?.[i] === undefined ? true : hourly.is_day[i] === 1;
            hourlyForecast.push({
                time: hourly.time?.[i] || '',
                hour: i === startIndex ? '现在' : this._formatClock(hourly.time?.[i]),
                isNow: i === startIndex,
                code,
                condition: this._mapWeatherCode(code),
                icon: this._mapIconKey(code, hourIsDay),
                description: this._getWeatherDescription(code),
                temperature: this._round(hourly.temperature_2m?.[i]),
                pop: this._round(hourly.precipitation_probability?.[i]),
                humidity: this._round(hourly.relative_humidity_2m?.[i]),
            });
        }

        return {
            city: cityName,
            latitude,
            longitude,
            timezone,
            localTime: this._formatClock(current.time),
            temperature: this._round(current.temperature_2m),
            high: this._round(todayHigh),
            low: this._round(todayLow),
            code: weatherCode,
            condition: this._mapWeatherCode(weatherCode),
            icon: this._mapIconKey(weatherCode, isDay !== false),
            description: this._getWeatherDescription(weatherCode),
            isDay,
            humidity: this._round(current.relative_humidity_2m),
            wind: current.wind_speed_10m === undefined ? null : Number(current.wind_speed_10m).toFixed(1),
            windDirection: current.wind_direction_10m ?? null,
            windDirectionLabel: this._formatWindDirection(current.wind_direction_10m),
            apparentTemp: this._round(current.apparent_temperature),
            cloudCover: this._round(current.cloud_cover),
            precipitation: current.precipitation ?? null,
            pop: forecast[0]?.pop ?? null,
            sunrise: forecast[0]?.sunrise || '',
            sunset: forecast[0]?.sunset || '',
            uv: this._round(daily.uv_index_max?.[0]),
            uvLevel: this._mapUvLevel(daily.uv_index_max?.[0]),
            // 免费版天气接口不含 AQI，取不到就留 null，由 UI 显示「--」而不是假装「优」
            aqi: air?.aqi ?? null,
            aqiLevel: air?.aqiLevel || '',
            pm25: air?.pm25 ?? null,
            forecast: forecast,
            hourly: hourlyForecast,
            updatedAt: Date.now(),
            source: 'open-meteo',
        };
    },

    /**
     * 在 hourly.time 里定位「当前整点」。
     * time 字段是城市当地时间的裸字符串（无时区后缀），字典序比较即可，
     * 交给 Date 解析反而会被浏览器时区带偏。
     */
    _findCurrentHourIndex(times, currentTime) {
        if (!Array.isArray(times) || times.length === 0) return 0;
        const nowKey = String(currentTime || '').slice(0, 13);
        if (!nowKey) return 0;
        for (let i = 0; i < times.length; i++) {
            if (String(times[i]).slice(0, 13) >= nowKey) return i;
        }
        return 0;
    },

    _round(value) {
        if (value === undefined || value === null || Number.isNaN(Number(value))) return null;
        return Math.round(Number(value));
    },

    /**
     * WMO 天气代码映射到应用内的天气状态（决定卡片渐变 / AI 播报口径）
     */
    _mapWeatherCode(code) {
        if (code === undefined || code === null) return 'cloudy';

        if (code === 0 || code === 1) return 'sunny';
        if (code === 2) return 'partly_cloudy';
        // 3 = overcast，必须落到 cloudy，否则「阴天」会被显示成「局部多云」
        if (code === 3) return 'cloudy';

        if (code === 45 || code === 48) return 'foggy';

        // 51-57 毛毛雨 / 61-67 雨 / 80-82 阵雨
        if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
            return 'rainy';
        }

        // 71-77 降雪 / 85-86 阵雪
        if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
            return 'snowy';
        }

        if (code >= 95 && code <= 99) return 'stormy';

        return 'cloudy';
    },

    /**
     * WMO 代码 → 图标键。比 condition 更细（区分小雨/大雨、白天/夜间），
     * 只影响图标选择，不影响 condition 语义。
     */
    _mapIconKey(code, isDay = true) {
        if (code === undefined || code === null) return 'cloudy';

        if (code === 0) return isDay ? 'sunny' : 'night';
        if (code === 1) return isDay ? 'partly_cloudy' : 'night_cloudy';
        if (code === 2) return isDay ? 'partly_cloudy' : 'night_cloudy';
        if (code === 3) return 'overcast';
        if (code === 45 || code === 48) return 'foggy';
        if (code >= 95) return 'stormy';
        if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snowy';
        // 中雨以上（含强阵雨、冻雨）用大雨图标
        if (code === 55 || code === 57 || code === 63 || code === 65 || code === 67 || code === 81 || code === 82) {
            return 'heavy_rain';
        }
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
        return 'cloudy';
    },

    /**
     * 获取天气描述
     */
    _getWeatherDescription(code) {
        if (code === undefined || code === null) return '';
        return WMO_DESCRIPTIONS[code] || '未知';
    },

    /**
     * 美标 AQI 分级（与国标 AQI 的档位一致）
     */
    _mapAqiLevel(value) {
        const aqi = Number(value);
        if (!Number.isFinite(aqi)) return '';
        if (aqi <= 50) return '优';
        if (aqi <= 100) return '良';
        if (aqi <= 150) return '轻度污染';
        if (aqi <= 200) return '中度污染';
        if (aqi <= 300) return '重度污染';
        return '严重污染';
    },

    _mapUvLevel(value) {
        const uv = Number(value);
        if (!Number.isFinite(uv)) return '';
        if (uv < 3) return '弱';
        if (uv < 6) return '中等';
        if (uv < 8) return '强';
        if (uv < 11) return '很强';
        return '极强';
    },

    _formatWindDirection(degrees) {
        const deg = Number(degrees);
        if (!Number.isFinite(deg)) return '';
        return WIND_DIR_LABELS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
    },

    /**
     * 日期标签：前三天用「今天/明天/后天」，之后用真实星期。
     * 用 Date.UTC 求星期，避免 new Date('2026-08-13') 被当成 UTC 零点后在负时区错位一天。
     */
    _formatDayLabel(dateStr, index) {
        if (index < RELATIVE_DAY_LABELS.length) return RELATIVE_DAY_LABELS[index];
        const parts = this._parseDateParts(dateStr);
        if (!parts) return '';
        const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
        return WEEKDAY_LABELS[weekday] || '';
    },

    _formatMonthDay(dateStr) {
        const parts = this._parseDateParts(dateStr);
        if (!parts) return '';
        return `${parts.month}/${parts.day}`;
    },

    /**
     * 从 ISO 裸字符串里截 HH:MM（当地时间），不走 Date 解析避免时区偏移
     */
    _formatClock(timeStr) {
        const text = String(timeStr || '');
        return text.length >= 16 ? text.slice(11, 16) : '';
    },

    _parseDateParts(dateStr) {
        const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
        if (!matched) return null;
        return { year: Number(matched[1]), month: Number(matched[2]), day: Number(matched[3]) };
    },

    /**
     * 清除缓存
     */
    clearCache() {
        this._cityCache.clear();
        this._weatherCache.clear();
    },

    /**
     * 获取缓存状态（调试用）
     */
    getCacheStats() {
        return {
            cityCacheSize: this._cityCache.size,
            weatherCacheSize: this._weatherCache.size,
        };
    },
};

// 导出
export default WeatherAPI;
