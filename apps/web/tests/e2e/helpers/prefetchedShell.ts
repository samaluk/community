import { expect, type Page } from '@playwright/test'

type ResponseChunks = {
  buffered: Buffer[]
  streamed: Buffer[]
}

/** Observes streamed RSC responses and waits for content in a target shell. */
export async function observePrefetchedShell(page: Page, pathname: string) {
  const cdp = await page.context().newCDPSession(page)
  const responses = new Map<string, ResponseChunks>()
  await cdp.send('Network.enable')

  cdp.on('Network.responseReceived', ({ requestId, response }) => {
    if (new URL(response.url).pathname !== pathname || response.mimeType !== 'text/x-component') {
      return
    }

    const chunks: ResponseChunks = { buffered: [], streamed: [] }
    responses.set(requestId, chunks)
    void cdp
      .send('Network.streamResourceContent', { requestId })
      .then(({ bufferedData }) => {
        if (bufferedData) chunks.buffered.push(Buffer.from(bufferedData, 'base64'))
      })
      .catch(() => {
        void cdp
          .send('Network.getResponseBody', { requestId })
          .then(({ body, base64Encoded }) => {
            chunks.buffered.push(Buffer.from(body, base64Encoded ? 'base64' : 'utf8'))
          })
          .catch(() => undefined)
      })
  })

  cdp.on('Network.dataReceived', ({ requestId, data }) => {
    if (data) responses.get(requestId)?.streamed.push(Buffer.from(data, 'base64'))
  })

  return {
    async waitUntilReady(marker: string) {
      const markerBytes = Buffer.from(marker)
      await expect
        .poll(
          () =>
            [...responses.values()].some(({ buffered, streamed }) =>
              Buffer.concat([...buffered, ...streamed]).includes(markerBytes),
            ),
          { timeout: 10_000 },
        )
        .toBe(true)
    },
    close: () => cdp.detach(),
  }
}
