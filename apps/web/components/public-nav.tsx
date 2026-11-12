'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, GraduationCap, Menu, X } from 'lucide-react';

const links = [
  { href: '/about', label: 'About' },
  { href: '/academy', label: 'Academy' },
  { href: '/markets', label: 'Markets' },
  { href: '/briefings', label: 'Insights' },
  { href: '/library', label: 'Library' },
  { href: '/contact', label: 'Contact' },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-[#eeeaf7] bg-white/90 backdrop-blur-xl">
    <div className="container-wide flex h-[76px] items-center justify-between">
      <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white"><GraduationCap size={22}/></span><span className="text-[18px] font-extrabold tracking-tight text-ink">Mali<span className="text-indigo-600">Scope</span></span></Link>
      <nav className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-[76px] flex-col gap-1 border-b border-[#eeeaf7] bg-white p-4 shadow-lg md:static md:flex md:flex-row md:items-center md:gap-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none`} aria-label="Main navigation">
        {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[13px] font-semibold text-[#69657F] hover:bg-[#F7F4FF] hover:text-indigo-600 md:px-0 md:py-2 md:hover:bg-transparent">{link.label}</Link>)}
        <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[13px] font-bold text-[#5D5877] hover:bg-[#F7F4FF] md:hidden">Sign in</Link>
      </nav>
      <div className="flex items-center gap-2"><Link href="/login" className="hidden px-3 py-2 text-[13px] font-bold text-[#5D5877] sm:inline-flex">Sign in</Link><Link href="/register" className="btn-primary">Get started <ArrowUpRight size={15}/></Link><button type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-xl text-[#615B7C] hover:bg-[#F4F1FA] md:hidden">{open ? <X size={20}/> : <Menu size={20}/>}</button></div>
    </div>
  </header>;
}
