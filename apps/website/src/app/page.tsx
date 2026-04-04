import { Nav } from "@/components/nav";
import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { Solution } from "@/components/sections/solution";
import { Ecosystem } from "@/components/sections/ecosystem";
import { SDK } from "@/components/sections/sdk";
import { Roadmap } from "@/components/sections/roadmap";
import { Notify } from "@/components/sections/notify";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <Ecosystem />
      <SDK />
      <Roadmap />
      <Notify />
      <Footer />
    </main>
  );
}
