import { createContext, useContext } from 'react'

export type Tab = 'home' | 'workout' | 'routines' | 'coach' | 'weight' | 'library'
export type Route = { tab: Tab; id?: string }
export type Navigate = (r: Route) => void

export const NavContext = createContext<Navigate>(() => {})
export const useNav = () => useContext(NavContext)
