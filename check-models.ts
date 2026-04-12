/**
 * 独立脚本：查询当前 API Key 可用的 Gemini 模型
 * 不修改任何项目代码，完全独立运行
 */

import * as fs from 'fs';
import * as path from 'path';

// 读取 .env.local
function loadEnv(): string {
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  if (!match || !match[1]) {
    throw new Error('❌ 无法在 .env.local 中找到 GEMINI_API_KEY');
  }
  
  return match[1].trim();
}

async function checkModels() {
  try {
    console.log('🔍 正在读取 .env.local...\n');
    const apiKey = loadEnv();
    console.log(`✅ 已获取 API Key (前16位): ${apiKey.substring(0, 16)}...\n`);

    console.log('📡 正在查询 Google API，获取可用模型列表...\n');

    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
    const url = `${baseUrl}/v1beta/models`;
    const resp = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`列表模型失败: ${resp.status} ${resp.statusText} ${text}`);
    }

    const data = await resp.json();
    const models = data.models || [];

    if (models.length === 0) {
      console.log('⚠️  未找到任何可用的模型');
      return;
    }

    console.log(`✨ 找到 ${models.length} 个可用模型：\n`);
    console.log('═══════════════════════════════════════════════════════════════');

    models.forEach((model: any, index: number) => {
      console.log(`\n[${index + 1}] 模型名称: ${model.name}`);
      console.log(`    显示名称: ${model.displayName || '未提供'}`);
      console.log(`    描述: ${model.description || '未提供'}`);
      if (model.supportedGenerationMethods) {
        console.log(`    支持方法: ${model.supportedGenerationMethods.join(', ')}`);
      }
    });
    
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    
    // 特别标记一些关键模型
    const flashModels = models.filter((m: any) => m.name && m.name.includes('flash'));
    const imagenModels = models.filter((m: any) => m.name && m.name.includes('imagen'));
    
    if (flashModels.length > 0) {
      console.log(`💡 [Flash 模型] 已检测到 ${flashModels.length} 个 Flash 模型`);
      flashModels.forEach((m: { name: string }) => console.log(`   - ${m.name}`));
      console.log();
    }
    
    if (imagenModels.length > 0) {
      console.log(`🎨 [Imagen 模型] 已检测到 ${imagenModels.length} 个 Imagen 模型`);
      imagenModels.forEach((m: { name: string }) => console.log(`   - ${m.name}`));
      console.log();
    }
    
    console.log('✅ 模型查询完成！');
    
  } catch (error: any) {
    console.error('❌ 出错了：');
    console.error(error.message || error);
    process.exit(1);
  }
}

checkModels();
