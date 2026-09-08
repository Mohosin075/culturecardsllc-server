import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import config from '../config'
import { Public } from '../app/modules/public/public.model'

function extractMainContent(htmlPath: string, fallbackTxtPath: string): string {
  if (fs.existsSync(htmlPath)) {
    const rawHtml = fs.readFileSync(htmlPath, 'utf-8')
    const match = /<main class="doc-content">([\s\S]*?)<\/main>/i.exec(rawHtml)
    if (match && match[1].trim()) {
      return match[1].trim()
    }
  }

  // Fallback to text file converted to simple paragraphs
  if (fs.existsSync(fallbackTxtPath)) {
    const rawTxt = fs.readFileSync(fallbackTxtPath, 'utf-8').trim()
    return rawTxt
      .split(/\n{2,}/)
      .map(p => {
        const t = p.trim()
        if (/^\d+\.\s+/.test(t)) {
          return `<h2>${t}</h2>`
        }
        return `<p>${t.replace(/\n/g, '<br />')}</p>`
      })
      .join('\n')
  }

  throw new Error(`Neither ${htmlPath} nor ${fallbackTxtPath} exists`)
}

async function seedLegalDocs() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.database_url as string)
    console.log('🚀 Database connected successfully')

    const rootDir = process.cwd()
    const ppHtmlPath = path.join(rootDir, 'src', 'privacy-policy.html')
    const ppTxtPath = path.join(rootDir, 'pp.txt')
    const ccHtmlPath = path.join(rootDir, 'src', 'terms-and-conditions.html')
    const ccTxtPath = path.join(rootDir, 'c&c.txt')

    const ppContent = extractMainContent(ppHtmlPath, ppTxtPath)
    const ccContent = extractMainContent(ccHtmlPath, ccTxtPath)

    // 1. Seed Terms & Conditions
    const termsResult = await Public.findOneAndUpdate(
      { type: 'terms-and-condition' },
      { $set: { content: ccContent } },
      { new: true, upsert: true },
    )
    console.log('✅ Terms & Conditions stored in MongoDB:', termsResult._id)

    // 2. Seed Privacy Policy
    const privacyResult = await Public.findOneAndUpdate(
      { type: 'privacy-policy' },
      { $set: { content: ppContent } },
      { new: true, upsert: true },
    )
    console.log('✅ Privacy Policy stored in MongoDB:', privacyResult._id)

    console.log('🎉 Legal documents stored into MongoDB successfully!')
  } catch (error) {
    console.error('❌ Error storing legal documents in database:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Database connection closed')
    process.exit(0)
  }
}

seedLegalDocs()
