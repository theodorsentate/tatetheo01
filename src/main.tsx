import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/react-router'
import { useStore } from '@/data/store'
import { ThemeProvider } from './context/theme-provider'
import { routeTree } from './routeTree.gen'
import './styles/index.css'

const queryClient = new QueryClient()

// The single-file demo build uses hash routing so it works from any host
// (including an artifact URL). Production deploys use normal paths.
const history =
  import.meta.env.VITE_HASH_ROUTER === 'true' ? createHashHistory() : undefined

const router = createRouter({
  routeTree,
  history,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Waitlist engine: expire stale offers and fill open seats, now and every minute.
useStore.getState().processWaitlists()
setInterval(() => useStore.getState().processWaitlists(), 60_000)

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
