'use client'

import { FormEvent, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { getMemberIdentifierConfig, type MemberIdentifierType } from '@/lib/memberIdentifiers'

type CheckStatus = 'active' | 'invalid_identifier' | 'not_found' | 'rate_limited'

type CheckResponse = {
  message: string
  status: CheckStatus
}

function isCheckStatus(status: unknown): status is CheckStatus {
  return (
    status === 'active' ||
    status === 'invalid_identifier' ||
    status === 'not_found' ||
    status === 'rate_limited'
  )
}

function parseCheckResponse(data: unknown): CheckResponse {
  if (typeof data !== 'object' || data === null) {
    return { message: 'Invalid response.', status: 'not_found' }
  }

  return { message: parseResponseMessage(data), status: parseResponseStatus(data) }
}

function parseResponseMessage(data: object): string {
  const fallback = 'Invalid response.'

  return 'message' in data && typeof data.message === 'string' ? data.message : fallback
}

function parseResponseStatus(data: object): CheckStatus {
  const status = 'status' in data ? data.status : null

  return isCheckStatus(status) ? status : 'not_found'
}

async function verifyMembership(identifier: string): Promise<CheckResponse> {
  const response = await fetch('/api/verify', {
    body: JSON.stringify({ identifier }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    // The check API reports outcomes through a `{ message, status }` JSON
    // body even on HTTP errors (400 invalid identifier, 404 not found, 429 rate
    // limited), so error responses are parsed and shown like successes.
    const errorData: unknown = await response.json()
    return parseCheckResponse(errorData)
  }

  const data: unknown = await response.json()
  return parseCheckResponse(data)
}

function VerifyResultBadge({ result }: { result: CheckResponse }) {
  return (
    <Badge
      className="h-auto justify-start whitespace-normal"
      variant={result.status === 'active' ? 'secondary' : 'destructive'}
    >
      {result.message}
    </Badge>
  )
}

export type VerifyFormProps = {
  identifierType?: MemberIdentifierType | null
}

export function VerifyForm({ identifierType }: VerifyFormProps) {
  const config = getMemberIdentifierConfig(identifierType)
  const [identifier, setIdentifier] = useState('')
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      setResult(await verifyMembership(identifier))
    } catch (error) {
      console.error('Failed to verify membership', error)
    }

    setIsSubmitting(false)
  }

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event)
      }}
    >
      <Card className="shadow-card" size="sm">
        <CardContent>
          <div className="flex flex-col gap-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">{config.label}</FieldLabel>
                <Input
                  className="min-h-10"
                  autoCapitalize="none"
                  autoComplete="off"
                  id="identifier"
                  inputMode="text"
                  name="identifier"
                  onChange={(event) => {
                    const raw = event.target.value
                    setIdentifier(config.formatInput ? config.formatInput(raw) : raw)
                  }}
                  placeholder={config.placeholder}
                  required
                  value={identifier}
                />
              </Field>
            </FieldGroup>
            <Button className="min-h-10 w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Verifying...
                </>
              ) : (
                'Verify membership'
              )}
            </Button>
            {result ? <VerifyResultBadge result={result} /> : null}
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
