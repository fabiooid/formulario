import { z } from 'zod'
import { libsql } from './client.js'
import { AccountExistsError, createProvisionedUser, replaceTemporaryPassword } from '../lib/auth.js'
import { generateTemporaryPassword } from '../lib/temporary-password.js'

function usage() {
  return `Create an account and print a temporary password.

Usage:
  npm run users:create -- person@example.com
  npm run users:create -- person@example.com --plan paid
  npm run users:create -- person@example.com --reset

--reset gives an existing account a new temporary password.
They choose their own password the first time they sign in.`
}

function readArgs(argv: string[]) {
  const planFlag = argv.indexOf('--plan')
  let plan: 'free' | 'paid' = 'free'
  if (planFlag !== -1) {
    const value = argv[planFlag + 1]
    if (value !== 'free' && value !== 'paid') return { error: 'Plan must be free or paid.\n\n' + usage() }
    plan = value
  }
  const reset = argv.includes('--reset')
  const email = argv.find((arg, index) => {
    if (arg.startsWith('-') || (planFlag !== -1 && index === planFlag + 1)) return false
    return z.string().email().safeParse(arg).success
  })
  if (!email) {
    return { error: 'Enter an email address.\n\n' + usage() }
  }
  return { email, plan, reset }
}

async function main() {
  const args = readArgs(process.argv.slice(2))
  if ('error' in args) {
    console.error(args.error)
    process.exitCode = 1
    return
  }

  const password = generateTemporaryPassword()
  if (args.reset) {
    const user = await replaceTemporaryPassword(args.email, password)
    if (!user) {
      console.error('No account with that email.')
      process.exitCode = 1
      return
    }
    console.log('Temporary password replaced')
  } else {
    try {
      await createProvisionedUser(args.email, password, args.plan)
    } catch (error) {
      if (error instanceof AccountExistsError) {
        console.error('An account with this email already exists. Use --reset to send a new temporary password.')
        process.exitCode = 1
        return
      }
      throw error
    }
    console.log('Account created')
  }

  console.log(`Email: ${args.email.trim().toLowerCase()}`)
  console.log(`Temporary password: ${password}`)
  console.log('')
  console.log('Send this password to them. They choose their own the first time they sign in.')
  console.log('This password is shown only now.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    libsql.close()
  })
