/**
 * relax-app / 「音声」面板
 *
 * 内置音是 Web Audio 现场合成的(见 services/sound-service.js),所以:
 *   - 点瓦片即试听,不用等加载
 *   - 每次响都有微小随机,连点不像复读机
 *
 * 自定义音:上传 → dataURL 存 IndexedDB → 首次播放时 decodeAudioData 缓存。
 *
 * ★ 试听必须发生在用户手势里(click),这样才能顺带解锁 AudioContext。
 *   所以「先点一次任意音」是让整个 app 出声的前提 —— 面板顶部有提示。
 *
 * ★ 音色清单本身(分组 / 折叠 / 长按收藏 / 排序)全在 RxSoundPicker 里,
 *   这里只负责「选中了谁」和「选完要不要试听」。捏捏音和界面点击音各挂一个,
 *   scope 不同,折叠状态互不干扰。
 */

import { RxSection, RxSlider, RxToggle } from '../shared.js';
import { RxSoundPicker } from '../sound-picker.js';
import { ICON_UPLOAD } from '../icons.js';

export const SoundPanel = {
    name: 'SoundPanel',
    components: { RxSection, RxSlider, RxToggle, RxSoundPicker },
    props: {
        scene: { type: Object, required: true },
        customSounds: { type: Array, default: () => [] },
        /** AudioContext 是否已解锁(父组件维护) */
        audioUnlocked: { type: Boolean, default: false },
    },
    emits: [
        'set-sound-enabled', 'set-sound-preset', 'set-sound-custom',
        'set-volume', 'set-haptics',
        'preview-sound', 'upload-sound', 'remove-sound',
        // ★ 界面点击音(点 tab / 按钮 / 瓦片时响的那一下),跟上面那套互相独立
        'set-ui-sound-enabled', 'set-ui-sound-preset', 'set-ui-sound-custom',
        'set-ui-volume', 'preview-ui-sound',
    ],
    computed: {
        usingCustom() {
            return !!this.scene.sound.customId;
        },
        uiUsingCustom() {
            return !!this.scene.uiSound.customId;
        },
    },
    methods: {
        onPickPreset(presetId) {
            this.$emit('set-sound-preset', presetId);
            // 选中即试听 —— 顺便在用户手势里解锁 AudioContext
            this.$emit('preview-sound', { presetId });
        },
        onPickCustom(sound) {
            this.$emit('set-sound-custom', sound.id);
            this.$emit('preview-sound', { customId: sound.id });
        },
        onPickUiPreset(presetId) {
            this.$emit('set-ui-sound-preset', presetId);
            this.$emit('preview-ui-sound', { presetId });
        },
        onPickUiCustom(sound) {
            this.$emit('set-ui-sound-custom', sound.id);
            this.$emit('preview-ui-sound', { customId: sound.id });
        },
        onFileChange(event) {
            const file = event.target.files?.[0];
            if (file) this.$emit('upload-sound', file);
            event.target.value = '';
        },
    },
    template: `
        <div class="rx-panel rx-panel-sound">
            <RxSection title="音声开关">
                <RxToggle
                    label="捏的时候出声"
                    :hint="audioUnlocked ? '' : '第一次需要点一下音色来唤醒扬声器'"
                    :value="scene.sound.enabled"
                    @change="$emit('set-sound-enabled', $event)"
                />
                <RxToggle
                    label="震动反馈"
                    hint="部分设备不支持"
                    :value="scene.sound.haptics"
                    @change="$emit('set-haptics', $event)"
                />
            </RxSection>

            <RxSection title="音色" hint="点一下试听 · 长按收藏">
                <RxSoundPicker
                    scope="main"
                    :custom-sounds="customSounds"
                    :preset-id="usingCustom ? null : scene.sound.presetId"
                    :custom-id="scene.sound.customId"
                    removable
                    @pick-preset="onPickPreset"
                    @pick-custom="onPickCustom"
                    @remove-custom="$emit('remove-sound', $event)"
                />
            </RxSection>

            <RxSection title="自己的音" hint="mp3 / wav / m4a,2MB 以内">
                <label class="rx-btn rx-btn-primary rx-btn-block rx-btn-file">
                    ${ICON_UPLOAD}
                    <span>上传音频</span>
                    <input type="file" accept="audio/*" @change="onFileChange" />
                </label>

                <p class="rx-hint-text">
                    <template v-if="customSounds.length">
                        传过 {{ customSounds.length }} 段,都在上面的「我的音声」组里,新的排最前。
                    </template>
                    <template v-else>
                        还没上传过。传一段自己的声音,捏的时候就会响它。
                    </template>
                </p>
            </RxSection>

            <RxSection title="音量">
                <RxSlider
                    label="响度"
                    :value="scene.sound.volume"
                    :min="0" :max="1" :step="0.02"
                    @change="$emit('set-volume', $event)"
                />
                <button
                    type="button"
                    class="rx-btn rx-btn-ghost rx-btn-block"
                    data-ui-mute
                    @click="$emit('preview-sound', {})"
                >试听当前音色</button>
            </RxSection>

            <!-- ★ 界面点击音:上面几块管的都是「捏的时候」,这块管「点界面的时候」 -->
            <RxSection title="界面点击音" hint="点 tab、按钮、瓦片都响一下">
                <RxToggle
                    label="点界面也出声"
                    hint="和「捏的时候出声」是两个独立开关"
                    :value="scene.uiSound.enabled"
                    @change="$emit('set-ui-sound-enabled', $event)"
                />

                <template v-if="scene.uiSound.enabled">
                    <RxSoundPicker
                        scope="ui"
                        :custom-sounds="customSounds"
                        :preset-id="uiUsingCustom ? null : scene.uiSound.presetId"
                        :custom-id="scene.uiSound.customId"
                        @pick-preset="onPickUiPreset"
                        @pick-custom="onPickUiCustom"
                    />

                    <RxSlider
                        label="响度"
                        :value="scene.uiSound.volume"
                        :min="0" :max="1" :step="0.02"
                        @change="$emit('set-ui-volume', $event)"
                    />
                    <p class="rx-hint-text">
                        界面音默认比捏捏音轻一点,免得盖过主角。设置会自动保存。
                    </p>
                </template>
            </RxSection>
        </div>
    `,
};
