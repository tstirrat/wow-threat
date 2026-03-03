#!/usr/bin/env node

/**
 * Uploads an image to a GitHub markdown editor and prints the generated asset URL.
 */
import { chromium } from '@playwright/test'
import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'

const defaultIssueUrl = 'https://github.com/tstirrat/wow-threat/issues/new'
const defaultProfileDir = `${homedir()}/.cache/wow-threat/playwright-github`
const defaultTimeoutMs = 180000
const defaultSettleMs = 1000

const attachmentUrlPattern =
  /https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+/g

const usage = `Usage:
  pnpm --filter @wow-threat/web upload:github-image -- <image-path> [options]

Options:
  --url <issue-url>          GitHub issue URL to open (default: ${defaultIssueUrl})
  --profile-dir <path>       Persistent Chromium profile dir (default: ${defaultProfileDir})
  --timeout-ms <ms>          Timeout for editor/url waits (default: ${defaultTimeoutMs})
  --settle-ms <ms>           Delay after upload before polling textarea (default: ${defaultSettleMs})
  --headless                 Run browser in headless mode
  -h, --help                 Show this help
`

/**
 * Parses CLI arguments for the uploader script.
 */
const parseArgs = (argv) => {
  const parsed = {
    headless: false,
    help: false,
    imagePath: '',
    profileDir: defaultProfileDir,
    settleMs: defaultSettleMs,
    timeoutMs: defaultTimeoutMs,
    url: defaultIssueUrl,
  }

  const readValue = (flag, index) => {
    const value = argv[index + 1]

    if (!value || value.startsWith('-')) {
      throw new Error(`Missing value for ${flag}`)
    }

    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      continue
    }

    if (arg === '-h' || arg === '--help') {
      parsed.help = true
      continue
    }

    if (arg === '--url') {
      parsed.url = readValue(arg, index)
      index += 1
      continue
    }

    if (arg === '--profile-dir') {
      parsed.profileDir = resolve(readValue(arg, index))
      index += 1
      continue
    }

    if (arg === '--timeout-ms') {
      parsed.timeoutMs = Number(readValue(arg, index))
      index += 1
      continue
    }

    if (arg === '--settle-ms') {
      parsed.settleMs = Number(readValue(arg, index))
      index += 1
      continue
    }

    if (arg === '--headless') {
      parsed.headless = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (parsed.imagePath.length > 0) {
      throw new Error(`Unexpected extra argument: ${arg}`)
    }

    parsed.imagePath = resolve(arg)
  }

  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0) {
    throw new Error('Expected --timeout-ms to be a positive number')
  }

  if (!Number.isFinite(parsed.settleMs) || parsed.settleMs < 0) {
    throw new Error('Expected --settle-ms to be a non-negative number')
  }

  return parsed
}

/**
 * Waits for a GitHub attachment URL to appear in the markdown textarea value.
 */
const waitForAttachmentUrl = async (page, editor, timeoutMs) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const value = await editor.inputValue()
    const matches = value.match(attachmentUrlPattern)

    if (matches && matches.length > 0) {
      return matches[matches.length - 1]
    }

    await page.waitForTimeout(200)
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for an uploaded attachment URL in the textarea`,
  )
}

/**
 * Finds the markdown uploader file input associated with the issue form.
 */
const findUploaderInput = async (form) => {
  const selectors = [
    'input[type="file"][data-upload-policy-url]',
    'input[type="file"][data-upload-url]',
    'input[type="file"]',
  ]

  for (const selector of selectors) {
    const candidate = form.locator(selector).first()

    if ((await candidate.count()) > 0) {
      return candidate
    }
  }

  throw new Error(
    'Could not find a file input associated with the markdown form',
  )
}

/**
 * Opens GitHub issue form, uploads an image, and prints the generated URL.
 */
const run = async () => {
  let args

  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error('\n' + usage)
    process.exit(1)
  }

  if (args.help) {
    console.log(usage)
    return
  }

  if (args.imagePath.length === 0) {
    console.error('Missing required <image-path> argument')
    console.error('\n' + usage)
    process.exit(1)
  }

  await access(args.imagePath, fsConstants.R_OK)

  const context = await chromium.launchPersistentContext(args.profileDir, {
    headless: args.headless,
    viewport: {
      height: 900,
      width: 1440,
    },
  })

  const page = context.pages()[0] ?? (await context.newPage())

  try {
    console.error(`Opening ${args.url}`)
    console.error(
      'If GitHub prompts for login, complete it in the opened browser window.',
    )

    await page.goto(args.url, {
      timeout: args.timeoutMs,
      waitUntil: 'domcontentloaded',
    })

    const editor = page.getByLabel('Markdown value')

    await editor.waitFor({
      state: 'visible',
      timeout: args.timeoutMs,
    })

    const issueForm = page.locator('form').filter({ has: editor }).first()
    const uploaderInput = await findUploaderInput(issueForm)

    console.error(`Uploading ${args.imagePath}`)
    await uploaderInput.setInputFiles(args.imagePath)

    if (args.settleMs > 0) {
      await page.waitForTimeout(args.settleMs)
    }

    const attachmentUrl = await waitForAttachmentUrl(
      page,
      editor,
      args.timeoutMs,
    )

    console.log(attachmentUrl)
  } finally {
    await context.close()
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
