import { createFileRoute } from "@tanstack/react-router";
import corridor from '@/assets/scoobert-corridor.jpg';
import music from '@/assets/still-life.mp3.asset.json';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Razy Tokens™ — Unlock Razy's Voice" },
      { name: "description", content: "Subscribe to Razy Tokens and give Razy a voice." },
      { property: "og:title", content: "Razy Tokens™ — Unlock Razy's Voice" },
      { property: "og:description", content: "Subscribe to Razy Tokens and give Razy a voice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const params = new URLSearchParams({ corridor, music: music.url });
  return <iframe src={`/razy.html?${params}`} allow="autoplay" title="Razy Tokens" className="fixed inset-0 h-screen w-screen border-0" />;
}
