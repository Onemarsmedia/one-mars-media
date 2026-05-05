'use client';

import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="bg-black text-white min-h-screen font-sans">
      <nav className="fixed top-0 w-full bg-black/85 backdrop-blur-sm z-50 border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl md:text-3xl font-bold tracking-tight">ONE MARS MEDIA</div>
            <a
              href="#contact"
              className="bg-white text-black px-5 py-3 rounded-full font-semibold hover:bg-gray-200 transition-colors"
            >
              Book a call
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-28">
        <section className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <p className="text-sm uppercase tracking-[0.35em] text-gray-500 mb-6">London-based video and AI content studio</p>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight mb-6">
                One Mars Media
              </h1>
              <p className="mx-auto max-w-3xl text-xl md:text-2xl text-gray-300 mb-12">
                Award-grade video production and AI content for brands that want modern campaigns, real reach, and clear results.
              </p>
              <a
                href="#contact"
                className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-full text-lg font-semibold transition-colors"
              >
                Book a call
              </a>
            </motion.div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-950">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.35em] text-gray-500 mb-4">Services</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Creative work that moves the business.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl bg-black p-8 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
                <p className="text-sm text-blue-400 uppercase tracking-[0.35em] mb-4">Commercial Video</p>
                <h3 className="text-2xl font-semibold mb-4">Brand films, product promos, hero ads.</h3>
                <p className="text-gray-400 leading-relaxed">High-end video for campaigns, launches, and hero stories that land fast.</p>
              </div>
              <div className="rounded-3xl bg-black p-8 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
                <p className="text-sm text-blue-400 uppercase tracking-[0.35em] mb-4">AI UGC Content</p>
                <h3 className="text-2xl font-semibold mb-4">AI-driven short form content.</h3>
                <p className="text-gray-400 leading-relaxed">Custom AI workflows for UGC, fast edits, and social-first output.</p>
              </div>
              <div className="rounded-3xl bg-black p-8 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
                <p className="text-sm text-blue-400 uppercase tracking-[0.35em] mb-4">AI Coaching</p>
                <h3 className="text-2xl font-semibold mb-4">Training brands and creators.</h3>
                <p className="text-gray-400 leading-relaxed">Get the tools, systems, and support to run AI content at scale.</p>
              </div>
              <div className="rounded-3xl bg-black p-8 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
                <p className="text-sm text-blue-400 uppercase tracking-[0.35em] mb-4">Social Content</p>
                <h3 className="text-2xl font-semibold mb-4">TikTok, Instagram and short-form funnels.</h3>
                <p className="text-gray-400 leading-relaxed">Content designed to grow attention, engagement, and direct response.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto grid gap-16 lg:grid-cols-[0.9fr_1.1fr] items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-gray-500 mb-4">About</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Mars, founder of One Mars Media.</h2>
              <p className="text-xl text-gray-300 leading-relaxed">
                Polish-British, based in London, 13 years of freelance experience. I work with brands worldwide on commercial video, AI UGC content, TikTok shop creative, and AI tools coaching.
              </p>
            </div>
            <div className="rounded-3xl bg-gray-950 border border-white/10 p-10 text-gray-300">
              <p className="text-lg leading-relaxed">
                The studio is built for brands that want bold, modern content without the usual agency noise. We move fast, stay sharp, and make every production count.
              </p>
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-950">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.35em] text-gray-500 mb-4">Stats</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Performance by the numbers.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl bg-black p-10 border border-white/10">
                <div className="text-5xl font-bold text-blue-400">14.4M</div>
                <p className="mt-4 text-gray-400">views in 60 days</p>
              </div>
              <div className="rounded-3xl bg-black p-10 border border-white/10">
                <div className="text-5xl font-bold text-blue-400">1M+</div>
                <p className="mt-4 text-gray-400">interactions</p>
              </div>
              <div className="rounded-3xl bg-black p-10 border border-white/10">
                <div className="text-5xl font-bold text-blue-400">13</div>
                <p className="mt-4 text-gray-400">years experience</p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              viewport={{ once: true }}
            >
              <p className="text-sm uppercase tracking-[0.35em] text-gray-500 mb-4">Contact</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Book a discovery call</h2>
              <p className="text-lg text-gray-300 mb-10">
                Ready to talk video, AI content, TikTok shop creative, or content systems? Let’s make it clear and direct.
              </p>
              <a
                href="mailto:hello@onemarsmedia.com"
                className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-full text-lg font-semibold transition-colors"
              >
                hello@onemarsmedia.com
              </a>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400">
          <p>© One Mars Media Ltd · London</p>
          <div className="flex flex-col sm:flex-row gap-6">
            <a href="https://instagram.com/marek_mars_" target="_blank" rel="noreferrer" className="hover:text-white">
              Instagram @marek_mars_
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="hover:text-white">
              TikTok
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
