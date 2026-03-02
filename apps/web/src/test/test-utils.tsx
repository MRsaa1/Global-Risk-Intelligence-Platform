import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

interface AllTheProvidersProps {
  children: React.ReactNode
  routerProps?: MemoryRouterProps
}

function AllTheProviders({ children, routerProps = {} }: AllTheProvidersProps) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter {...routerProps}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { routerProps?: MemoryRouterProps }
) {
  const { routerProps, ...renderOptions } = options ?? {}
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders routerProps={routerProps}>{children}</AllTheProviders>
    ),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { customRender as render }
