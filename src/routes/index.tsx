import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from 'react';
import { accountBridge } from '@/lib/account-bridge';
import corridor from '@/assets/scoobert-corridor.jpg';
import music from '@/assets/still-life.mp3.asset.json';
import timewarpMusic from '@/assets/timewarp-still-life.mp3.asset.json';
import scream from '@/assets/timewarp-scream.mp3.asset.json';
import dog from '@/assets/scoobert-dog.png.asset.json';
import transmission from '@/assets/timewarp-transmission.mp4.asset.json';

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
  useEffect(() => {
    window.razyAccounts = accountBridge;
    return () => { delete window.razyAccounts; };
  }, []);
  const params = new URLSearchParams({ corridor, music: music.url, timewarpMusic: timewarpMusic.url, scream: scream.url, dog: dog.url, transmission: transmission.url });
  return <iframe src={`/razy.html?${params}`} allow="autoplay" title="Razy Tokens" className="fixed inset-0 h-screen w-screen border-0" />;
}
