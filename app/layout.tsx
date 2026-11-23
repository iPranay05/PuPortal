import type { Metadata, Viewport } from 'next'
import './globals.css'
export const metadata: Metadata = {title:'Accreditation Workspace | Pillai University',description:'Explore accreditation modules, record definitions and the PostgreSQL schema for Pillai University.',icons:{icon:'/crest.webp'}}
export const viewport: Viewport = {themeColor:'#561529',colorScheme:'light'}
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
