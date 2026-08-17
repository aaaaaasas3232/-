/**
 * 探针跑崩之后清场:杀掉残留的无头 Edge。
 * 端口被上一轮占着的话,下一次 launch 只会报一句「浏览器没起来」,查不出原因。
 */
import { execSync } from 'node:child_process';

try {
    const out = execSync('tasklist /FI "IMAGENAME eq msedge.exe" /FO CSV', { encoding: 'utf8' });
    const lines = out.trim().split('\n').filter(l => l.includes('msedge.exe'));
    console.log(`msedge 进程:${lines.length}`);
    if (lines.length) {
        execSync('taskkill /F /IM msedge.exe /T', { stdio: 'ignore' });
        console.log('已清理');
    }
} catch (err) {
    console.log('清理时出错(通常说明本来就没有):', String(err.message).slice(0, 120));
}
