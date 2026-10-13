import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the backend health status once it resolves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'UP' }),
      }),
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/UP/)).toBeInTheDocument()
    })
  })
})
