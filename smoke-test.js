// 问渠冒烟测试 —— 每次改完 index.html 后跑一遍,自动验证关键路径没崩。
// 用法: node smoke-test.js  (需先 npm i playwright 或用已装环境)
// 它会打开 index.html,走一遍所有主要交互,任何一步失败或有 JS 错误就报警。

const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'index.html');
let failed = 0;
function check(name, cond) {
  const ok = !!cond;
  console.log(`  ${ok ? '✓' : '✗ 失败:'} ${name}${ok ? '' : ` (得到: ${cond})`}`);
  if (!ok) failed++;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  for (const scheme of ['light', 'dark']) {
    console.log(`\n=== ${scheme} 模式 ===`);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    page.on('pageerror', e => errors.push(`[${scheme}] ${e}`));

    await page.goto(FILE);
    await page.waitForTimeout(2000);

    // 1. 登录界面出现
    check('登录界面显示', await page.evaluate(() => {
      const a = document.querySelector('#authView');
      return a && !a.classList.contains('hide');
    }));

    // 2. 背景铺满(不露系统灰)
    check('html背景=paper', await page.evaluate(() => {
      const bg = getComputedStyle(document.documentElement).backgroundColor;
      const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    }));

    // 3. 跳过登录进主界面
    await page.click('#authSkip');
    await page.waitForTimeout(400);
    check('进入主界面', await page.evaluate(() => document.querySelector('#authView').classList.contains('hide')));
    check('线索列表有内容', await page.evaluate(() => document.querySelectorAll('.thread').length) >= 1);

    // 4. 进详情页
    await page.click('.thread');
    await page.waitForTimeout(400);
    check('详情页有片段', await page.evaluate(() => document.querySelectorAll('.seg').length) >= 1);
    check('片段有编辑入口', await page.evaluate(() => document.querySelectorAll('.sedit').length) >= 1);
    check('标题可编辑', await page.evaluate(() => document.querySelector('#dTitle')?.getAttribute('contenteditable')) === 'true');
    check('返回按钮存在', await page.evaluate(() => !!document.querySelector('.back')));

    // 5. 加片段浮层能开
    await page.click('.addseg');
    await page.waitForTimeout(300);
    check('加片段浮层打开', await page.evaluate(() => document.querySelector('#segSheet').classList.contains('show')));
    check('类型选项齐(5种)', await page.evaluate(() => document.querySelectorAll('#kTabs .ktab').length) === 5);
    await page.click('#sCancel');
    await page.waitForTimeout(200);

    // 6. 返回列表
    await page.click('.back');
    await page.waitForTimeout(300);
    check('返回列表成功', await page.evaluate(() => document.querySelector('#listView').style.display !== 'none'));

    // 7. 切脉络图
    await page.evaluate(() => document.querySelectorAll('.vtab')[1].click());
    await page.waitForTimeout(800);
    check('脉络图有节点', await page.evaluate(() => document.querySelectorAll('#galaxy .gnode').length) >= 1);

    // 8. 设置页
    await page.click('#gearBtn');
    await page.waitForTimeout(300);
    check('设置页打开', await page.evaluate(() => document.querySelector('#panel').classList.contains('show')));
    check('账号行存在', await page.evaluate(() => !!document.querySelector('#acctBtn')));
    check('导出/导入/清空都在', await page.evaluate(() =>
      !!document.querySelector('#exportBtn') && !!document.querySelector('#importBtn') && !!document.querySelector('#clearBtn')));

    await page.close();
  }

  console.log('\n=== JS 运行时错误 ===');
  if (errors.length) { errors.forEach(e => console.log('  ✗ ' + e)); failed += errors.length; }
  else console.log('  ✓ 无');

  await browser.close();
  console.log(`\n${'='.repeat(30)}`);
  console.log(failed === 0 ? '✓ 全部通过' : `✗ ${failed} 项失败`);
  process.exit(failed === 0 ? 0 : 1);
})();
