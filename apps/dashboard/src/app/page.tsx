import { DURANDAL_VERSION } from "@durandal/core";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold tracking-wider mb-4 bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
        DURANDAL
      </h1>
      <p className="text-gray-400 text-lg mb-2">
        Your unbreakable AI workforce.
      </p>
      <p className="text-gray-600 text-sm">v{DURANDAL_VERSION}</p>
    </main>
  );
}
