
import { Link } from 'react-router-dom'
import { ArrowRight, Recycle } from 'lucide-react'

function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#e5f2e9] via-[#f5f8f6] to-white p-4">
      <div className="w-full max-w-xl rounded-[2rem] border bg-white p-7 text-center shadow-xl shadow-emerald-950/5 sm:p-12">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-[#e7f3ec] text-[#167d61]">
          <Recycle size={34} aria-hidden="true" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#153e31] sm:text-5xl">
          Recycle Connect
        </h1>

        <p className="mx-auto mt-4 max-w-sm leading-relaxed text-slate-600">
          Đặt lịch thu gom rác tái chế và theo dõi tiến độ xử lý yêu cầu.
        </p>

        <Link
          to="/login"
          className="mt-7 inline-flex items-center gap-3 rounded-xl bg-[#167d61] px-6 py-3 font-semibold text-white transition hover:bg-[#11634d]"
        >
          Đăng nhập <ArrowRight size={18} aria-hidden="true" />
        </Link>

      </div>
    </main>
  )
}

export default Home
