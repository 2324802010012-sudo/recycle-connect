
import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
      <div className="bg-white shadow-xl rounded-2xl p-10 text-center max-w-xl w-full">
        <div className="text-5xl mb-4">♻️</div>

        <h1 className="text-4xl font-bold text-[#167D61]">
          RECYCLE CONNECT
        </h1>

        <p className="mt-4 text-gray-600">
          Hệ thống tiếp nhận và điều phối yêu cầu
          thu gom rác tái chế theo thời gian thực
        </p>

        <Link
          to="/login"
          className="inline-block mt-6 bg-[#167D61] hover:bg-[#11634D] text-white px-8 py-3 rounded-xl font-semibold"
        >
          Bắt đầu
        </Link>

        <p className="mt-6 text-sm text-gray-400">
          Serverless Cloud Platform
        </p>
      </div>
    </div>
  )
}

export default Home
