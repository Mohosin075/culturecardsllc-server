import cors from 'cors'
import express, { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import path from 'path'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import passport from './app/modules/auth/passport.auth/config/passport'
import router from './routes'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import config from './config'
import webhookApp from './webhook'
import sendResponse from './shared/sendResponse'
import morgan from 'morgan'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerDocs from './utils/swagger'
import { DeepLinkRoutes } from './app/modules/deeplink/deeplink.route'

const app = express()

// ✅ CORS MUST be first — before helmet, session, passport, everything
// This ensures preflight OPTIONS requests get correct headers
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = config.cors_origins.length > 0
        ? config.cors_origins
        : ['http://localhost:3000']
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS: Origin ${origin} not allowed`), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Accept'],
  }),
)
// Handle preflight requests for all routes
app.options('*', cors())

// Security headers
app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
})
if (config.node_env !== 'development') {
  app.use('/api', limiter)
}

// ⚠️ CRITICAL: Webhook MUST be before body parsers to receive raw body
app.use(webhookApp)

// -------------------- Middleware --------------------
// Body parsers must come after webhook
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Session must come before passport
app.use(
  session({
    secret: config.jwt.jwt_secret || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.node_env === 'production', // true if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
)

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// CORS is already applied at the top of the middleware stack

// Cookie parser
app.use(cookieParser())

// Logging
app.use(morgan('dev'))

// -------------------- Static Files --------------------
// Serve uploads folder statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
app.use(express.static(path.join(process.cwd(), 'uploads')))

// -------------------- Deep Linking & Open Graph Social Previews --------------------
app.use('/', DeepLinkRoutes)

// -------------------- API Routes --------------------
app.use('/api/v1', router)

// Swagger Documentation
swaggerDocs(app, Number(config.port))

import { Public } from './app/modules/public/public.model'

const renderLegalHtml = (
  title: string,
  content: string,
  type: 'privacy-policy' | 'terms-and-condition',
) => {
  if (content.includes('<html') || content.includes('<!doctype')) {
    return content
  }

  // Extract or inject section IDs on h2 elements for TOC linking
  let sectionIndex = 1
  const tocItems: { id: string; num: string; title: string }[] = []

  let bodyHtml = content
  const hasSections = /<section\s+[^>]*id=["']([^"']+)["']/i.test(content)

  if (hasSections) {
    const sectionRegex = /<section\s+[^>]*id=["']([^"']+)["'][^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi
    let match: RegExpExecArray | null
    while ((match = sectionRegex.exec(content)) !== null) {
      const id = match[1]
      const rawTitle = match[2].replace(/<[^>]+>/g, '').trim()
      const num = String(sectionIndex).padStart(2, '0')
      tocItems.push({ id, num, title: rawTitle })
      sectionIndex++
    }
  } else if (/<h2[^>]*>/i.test(content)) {
    bodyHtml = content.replace(
      /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
      (_match, attrs, innerText) => {
        const rawTitle = innerText.replace(/<[^>]+>/g, '').trim()
        const idMatch = /id=["']([^"']+)["']/i.exec(attrs)
        const id = idMatch ? idMatch[1] : `section-${sectionIndex}`
        const num = String(sectionIndex).padStart(2, '0')
        tocItems.push({ id, num, title: rawTitle })
        sectionIndex++
        const cleanAttrs = attrs.replace(/\s*id=["'][^"']*["']/i, '')
        return `<section id="${id}" class="doc-section"><div class="section-header"><span class="section-num">${num}</span><h2${cleanAttrs} class="section-title">${innerText}</h2></div>`
      },
    )
  } else if (!/<\/?[a-z][\s\S]*>/i.test(content)) {
    // If plaintext without HTML tags
    bodyHtml = content
      .split(/\n{2,}/)
      .map(paragraph => `<p>${paragraph.trim().replace(/\n/g, '<br />')}</p>`)
      .join('\n')
  }

  const tocHtml = tocItems.length > 0
    ? `<aside class="sidebar-toc">
        <div class="toc-title">Table of Contents</div>
        <ul class="toc-list">
          ${tocItems
            .map(
              (item, i) =>
                `<li><a href="#${item.id}" class="toc-link ${i === 0 ? 'active' : ''}">${item.title}</a></li>`,
            )
            .join('\n')}
        </ul>
      </aside>
      <details class="mobile-toc">
        <summary class="mobile-toc-summary">
          <span>📑 Jump to Section (${tocItems.length} Sections)</span>
          <span class="toc-arrow">▼</span>
        </summary>
        <ul class="mobile-toc-list">
          ${tocItems
            .map(
              item =>
                `<li><a href="#${item.id}" onclick="this.closest('details').removeAttribute('open')">${item.title}</a></li>`,
            )
            .join('\n')}
        </ul>
      </details>`
    : ''

  const nextDocTitle =
    type === 'privacy-policy' ? 'Terms & Conditions' : 'Privacy Policy'
  const nextDocUrl =
    type === 'privacy-policy' ? '/terms-and-conditions' : '/privacy-policy'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - AREIS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      :root {
        --primary: #155dfc;
        --primary-hover: #0d48cc;
        --primary-light: #eff6ff;
        --primary-glow: rgba(21, 93, 252, 0.12);
        --slate-900: #0f172a;
        --slate-800: #1e293b;
        --slate-700: #334155;
        --slate-600: #475569;
        --slate-500: #64748b;
        --slate-400: #94a3b8;
        --slate-200: #e2e8f0;
        --slate-100: #f1f5f9;
        --slate-50: #f8fafc;
        --white: #ffffff;
        --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
        --radius-lg: 16px;
        --radius-md: 12px;
        --radius-sm: 8px;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        background-color: var(--slate-50);
        color: var(--slate-800);
        line-height: 1.75;
        -webkit-font-smoothing: antialiased;
      }
      .top-navbar {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--slate-200);
      }
      .navbar-inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: 14px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand-group { display: flex; align-items: center; gap: 12px; text-decoration: none; }
      .brand-badge {
        width: 38px; height: 38px; border-radius: 10px;
        background: linear-gradient(135deg, var(--primary) 0%, #0d42b8 100%);
        color: var(--white); display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 1.1rem; box-shadow: 0 4px 12px var(--primary-glow);
      }
      .brand-text { display: flex; flex-direction: column; }
      .brand-title { font-size: 1.15rem; font-weight: 800; color: var(--slate-900); letter-spacing: -0.02em; line-height: 1.2; }
      .brand-subtitle { font-size: 0.72rem; font-weight: 600; color: var(--slate-500); text-transform: uppercase; letter-spacing: 0.05em; }
      .nav-links { display: flex; align-items: center; gap: 8px; }
      .nav-tab { padding: 8px 16px; border-radius: var(--radius-sm); font-size: 0.88rem; font-weight: 600; text-decoration: none; color: var(--slate-600); transition: all 0.2s; }
      .nav-tab:hover { color: var(--slate-900); background-color: var(--slate-100); }
      .nav-tab.active { color: var(--primary); background-color: var(--primary-light); }
      .action-btns { display: flex; align-items: center; gap: 10px; }
      .btn-print {
        padding: 8px 14px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600;
        border: 1px solid var(--slate-200); background: var(--white); color: var(--slate-700);
        cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
      }
      .btn-print:hover { background: var(--slate-50); border-color: var(--slate-400); }
      .hero-header {
        background: linear-gradient(180deg, #ffffff 0%, var(--slate-50) 100%);
        border-bottom: 1px solid var(--slate-200); padding: 56px 24px 44px; text-align: center;
      }
      .hero-inner { max-width: 860px; margin: 0 auto; }
      .pill-badge {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px;
        background: var(--primary-light); color: var(--primary); font-size: 0.78rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px;
      }
      .hero-title { font-size: 2.75rem; font-weight: 800; color: var(--slate-900); letter-spacing: -0.03em; line-height: 1.2; margin-bottom: 14px; }
      .hero-meta { display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 0.88rem; color: var(--slate-500); }
      .meta-item { display: flex; align-items: center; gap: 6px; }
      .page-layout {
        max-width: 1280px; margin: 40px auto 80px; padding: 0 24px;
        display: grid; grid-template-columns: ${tocItems.length > 0 ? '280px minmax(0, 1fr)' : 'minmax(0, 1fr)'};
        gap: 48px; align-items: start;
      }
      .sidebar-toc {
        position: sticky; top: 90px; background: var(--white); border: 1px solid var(--slate-200);
        border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm);
        max-height: calc(100vh - 120px); overflow-y: auto;
      }
      .toc-title { font-size: 0.82rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate-400); margin-bottom: 16px; }
      .toc-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
      .toc-link {
        display: block; padding: 6px 12px; border-radius: 6px; font-size: 0.84rem; font-weight: 500;
        color: var(--slate-600); text-decoration: none; line-height: 1.4; transition: all 0.15s ease;
        border-left: 2px solid transparent;
      }
      .toc-link:hover { color: var(--primary); background: var(--slate-50); }
      .toc-link.active { color: var(--primary); font-weight: 700; background: var(--primary-light); border-left-color: var(--primary); }
      .doc-content {
        background: var(--white); border: 1px solid var(--slate-200); border-radius: var(--radius-lg);
        padding: 56px 64px; box-shadow: var(--shadow-md);
      }
      .doc-section { padding-top: 36px; margin-top: 36px; border-top: 1px solid var(--slate-200); }
      .doc-section:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
      .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
      .section-num {
        width: 30px; height: 30px; border-radius: 8px; background: var(--slate-100); color: var(--slate-700);
        display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace;
        font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
      }
      .section-title { font-size: 1.45rem; font-weight: 700; color: var(--slate-900); letter-spacing: -0.02em; }
      .subsection-title { font-size: 1.08rem; font-weight: 700; color: var(--slate-800); margin: 22px 0 8px; }
      p { color: var(--slate-700); margin-bottom: 16px; font-size: 0.98rem; line-height: 1.75; }
      ul { margin: 12px 0 20px 24px; color: var(--slate-700); }
      li { margin-bottom: 8px; font-size: 0.98rem; line-height: 1.7; }
      strong { color: var(--slate-900); font-weight: 600; }
      a { color: var(--primary); text-decoration: none; font-weight: 500; }
      a:hover { text-decoration: underline; }
      .summary-box { background: var(--primary-light); border-left: 4px solid var(--primary); border-radius: var(--radius-md); padding: 16px 20px; margin: 16px 0; font-size: 0.92rem; color: var(--slate-800); }
      .summary-box p { margin: 0; }
      .summary-box p + p { margin-top: 8px; }
      .contact-box { background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 18px 22px; margin: 18px 0; font-size: 0.92rem; }
      .contact-box p { margin: 0; }
      .contact-box p + p { margin-top: 10px; }
      .notice { font-style: italic; color: var(--slate-500); margin: 12px 0; font-size: 0.9rem; }
      .legal-section { margin-bottom: 28px; }
      .legal-section h2 { font-size: 1.35rem; font-weight: 700; color: var(--slate-900); padding-bottom: 8px; border-bottom: 1px solid var(--slate-200); margin: 28px 0 12px; }
      .legal-section h3 { font-size: 1.05rem; font-weight: 600; color: var(--slate-800); margin: 18px 0 6px; }
      .legal-list { list-style-type: disc; padding-left: 22px; margin: 12px 0; color: var(--slate-700); }
      .legal-list li { margin-bottom: 6px; line-height: 1.65; }
      .next-doc-card {
        margin-top: 48px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 28px;
        display: flex; align-items: center; justify-content: space-between; gap: 20px;
      }
      .next-doc-btn { padding: 10px 20px; background: var(--primary); color: var(--white); font-weight: 600; border-radius: var(--radius-sm); text-decoration: none; }
      .footer-bar { text-align: center; padding: 40px 24px; color: var(--slate-500); font-size: 0.88rem; border-top: 1px solid var(--slate-200); background: var(--white); }
      .mobile-toc { display: none; }
      @media (max-width: 992px) {
        .page-layout { grid-template-columns: 1fr; gap: 16px; padding: 0 16px; margin: 20px auto 48px; }
        .sidebar-toc { display: none; }
        .mobile-toc {
          display: block;
          background: var(--white);
          border: 1px solid var(--slate-200);
          border-radius: var(--radius-md);
          margin-bottom: 16px;
          box-shadow: var(--shadow-sm);
        }
        .mobile-toc-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--slate-800);
          cursor: pointer;
          user-select: none;
        }
        .mobile-toc[open] .mobile-toc-summary {
          border-bottom: 1px solid var(--slate-100);
        }
        .mobile-toc[open] .toc-arrow {
          transform: rotate(180deg);
        }
        .toc-arrow { transition: transform 0.2s ease; font-size: 0.72rem; color: var(--slate-400); }
        .mobile-toc-list {
          list-style: none;
          padding: 8px 12px;
          max-height: 280px;
          overflow-y: auto;
        }
        .mobile-toc-list li a {
          display: block;
          padding: 8px 10px;
          border-radius: 6px;
          color: var(--slate-700);
          font-size: 0.85rem;
          text-decoration: none;
        }
        .mobile-toc-list li a:active {
          background: var(--primary-light);
          color: var(--primary);
        }
        .doc-content { padding: 22px 16px; border-radius: 12px; }
        .hero-header { padding: 32px 16px 24px; }
        .hero-title { font-size: 1.75rem; margin-bottom: 10px; }
        .hero-meta { flex-direction: column; gap: 6px; font-size: 0.82rem; }
        .navbar-inner { padding: 10px 16px; }
        .brand-subtitle { display: none; }
        .btn-print { display: none; }
        .nav-links { gap: 4px; }
        .nav-tab { padding: 6px 10px; font-size: 0.8rem; }
        .next-doc-card { flex-direction: column; align-items: flex-start; gap: 14px; padding: 18px; }
        .next-doc-btn { width: 100%; text-align: center; }
        .legal-section h2 { font-size: 1.18rem; margin-top: 20px; }
        .legal-section h3 { font-size: 0.96rem; }
        p, li { font-size: 0.92rem; line-height: 1.68; }
      }
    </style>
  </head>
  <body>
    <header class="top-navbar">
      <div class="navbar-inner">
        <a href="/" class="brand-group">
          <div class="brand-badge">A</div>
          <div class="brand-text">
            <span class="brand-title">AREIS</span>
            <span class="brand-subtitle">Legal Center</span>
          </div>
        </a>
        <nav class="nav-links">
          <a href="/privacy-policy" class="nav-tab ${type === 'privacy-policy' ? 'active' : ''}">Privacy Policy</a>
          <a href="/terms-and-conditions" class="nav-tab ${type === 'terms-and-condition' ? 'active' : ''}">Terms & Conditions</a>
        </nav>
        <div class="action-btns">
          <button class="btn-print" onclick="window.print()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            <span>Print</span>
          </button>
        </div>
      </div>
    </header>

    <section class="hero-header">
      <div class="hero-inner">
        <div class="pill-badge">Official Policy</div>
        <h1 class="hero-title">${title}</h1>
        <div class="hero-meta">
          <div class="meta-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Last Updated: September 6, 2026</span>
          </div>
          <div class="meta-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>AREIS LLC • Florida, USA</span>
          </div>
        </div>
      </div>
    </section>

    <div class="page-layout">
      ${tocHtml}
      <main class="doc-content">
        ${bodyHtml}
        <div class="next-doc-card">
          <div>
            <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--primary);margin-bottom:4px;">Next Legal Policy</h4>
            <p style="font-size:1.15rem;font-weight:700;color:var(--slate-900);">${nextDocTitle}</p>
          </div>
          <a href="${nextDocUrl}" class="next-doc-btn">Read ${nextDocTitle} &rarr;</a>
        </div>
      </main>
    </div>

    <footer class="footer-bar">
      <p>&copy; 2026 AREIS LLC. All rights reserved. | <a href="/terms-and-conditions">Terms & Conditions</a> | <a href="/privacy-policy">Privacy Policy</a></p>
    </footer>

    <script>
      document.addEventListener('DOMContentLoaded', () => {
        const sections = document.querySelectorAll('.legal-section, .doc-section, section[id^="section-"]');
        const tocLinks = document.querySelectorAll('.toc-link');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              tocLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + id);
              });
            }
          });
        }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
        sections.forEach(section => observer.observe(section));
      });
    </script>
  </body>
</html>`
}

// -------------------- Public Legal Routes --------------------
app.get('/privacy-policy', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Public.findOne({ type: 'privacy-policy' }).lean()
    if (doc && doc.content && doc.content.trim().length > 0) {
      res.send(renderLegalHtml('Privacy Policy', doc.content, 'privacy-policy'))
      return
    }
  } catch (error) {
    // Database query error
  }
  res.send(
    renderLegalHtml(
      'Privacy Policy',
      '<p>The Privacy Policy is currently being updated. Please check back shortly.</p>',
      'privacy-policy',
    ),
  )
})

const handleTermsAndConditions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const doc = await Public.findOne({ type: 'terms-and-condition' }).lean()
    if (doc && doc.content && doc.content.trim().length > 0) {
      res.send(
        renderLegalHtml('Terms & Conditions', doc.content, 'terms-and-condition'),
      )
      return
    }
  } catch (error) {
    // Database query error
  }
  res.send(
    renderLegalHtml(
      'Terms & Conditions',
      '<p>The Terms & Conditions are currently being updated. Please check back shortly.</p>',
      'terms-and-condition',
    ),
  )
}

app.get('/terms-and-conditions', handleTermsAndConditions)
app.get('/terms', handleTermsAndConditions)
app.get('/terms-of-service', handleTermsAndConditions)

router.get('/status', (req: Request, res: Response) => {
  try {
    const healthCheck = {
      success: true,
      message: 'Server is running smoothly',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: config.node_env,
    }

    res.status(StatusCodes.OK).json(healthCheck)
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Server is experiencing issues',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// -------------------- Root Response --------------------
app.get('/', (req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Welcome to the Aries API CI/CD',
    data: {
      timestamp: new Date().toISOString(),
      projectName: 'Aries',
      version: '1.0.0',
    },
  })
})

// -------------------- Global Error Handler --------------------
app.use(globalErrorHandler)

// -------------------- 404 Handler --------------------
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'The requested resource was not found on this server.',
    errorMessages: [
      {
        path: req.originalUrl,
        message: 'Endpoint does not exist',
      },
    ],
    timestamp: new Date().toISOString(),
  })
})

export default app
