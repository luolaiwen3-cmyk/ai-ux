/**
 * 检查 localStorage 中的 rrweb 数据完整性
 * 在浏览器 Console 中运行此检查
 */

// 这个脚本用于在浏览器中检查数据
// 请在浏览器 Console 中粘贴以下代码并运行：

const checkCode = `
// 检查 rrweb 数据完整性
console.log('=== rrweb 数据完整性检查 ===');

// 1. 检查会话索引
const index = JSON.parse(localStorage.getItem('rrweb-session-index') || '[]');
console.log('会话索引:', index);

// 2. 检查每个会话的事件
index.forEach(s => {
  const events = JSON.parse(localStorage.getItem('rrweb-events-' + s.id) || '[]');
  console.log('\\n会话 ' + s.id + ':');
  console.log('  事件数:', events.length);

  if (events.length > 0) {
    // 检查首事件
    const first = events[0];
    console.log('  首事件类型:', first.type, '(0=FullSnapshot, 2=Mutation, 3=Mouse)');
    console.log('  首事件时间戳:', first.timestamp);

    // 检查事件类型分布
    const types = {};
    events.forEach(e => {
      types[e.type] = (types[e.type] || 0) + 1;
    });
    console.log('  事件类型分布:', types);

    // 检查是否有完整快照
    const hasSnapshot = events.some(e => e.type === 0);
    console.log('  包含完整快照:', hasSnapshot);

    // 检查数据大小
    const size = new Blob([JSON.stringify(events)]).size;
    console.log('  数据大小:', (size / 1024).toFixed(2), 'KB');

    // 验证事件结构
    const invalid = events.filter(e => !e.type && e.type !== 0);
    if (invalid.length > 0) {
      console.log('  ⚠ 无效事件:', invalid.length);
    }
  }
});

console.log('\\n=== 检查完成 ===');
`;

console.log('请在浏览器 Console 中运行以下代码：');
console.log(checkCode);

// 同时检查 rrweb 版本
import { record, Replayer } from 'rrweb';
console.log('\\nrrweb 版本检查:');
console.log('  record:', typeof record);
console.log('  Replayer:', typeof Replayer);
