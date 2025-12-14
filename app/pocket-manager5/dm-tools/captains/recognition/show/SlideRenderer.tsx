"use client";
import React from "react";

export default function SlideRenderer({ slide, nextSlide, themeFrameClass }: { slide: any; nextSlide?: any; themeFrameClass?: string }) {
  return (
    <div className={`relative w-full h-full ${themeFrameClass ?? "bg-slate-900"}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-5xl w-full p-8 text-center">
          <h2 className="text-4xl font-bold text-white">{slide?.title ?? "Slide"}</h2>
          {slide?.payload ? <pre className="text-left text-xs text-slate-200 mt-4">{JSON.stringify(slide.payload, null, 2)}</pre> : null}
        </div>
      </div>

      {/* Offscreen pre-warm next slide */}
      {nextSlide ? (
        <div aria-hidden className="pointer-events-none opacity-0 absolute -left-[99999px]">
          <div className="w-[1600px] h-[900px]">{nextSlide?.title ?? "prewarm"}</div>
        </div>
      ) : null}
    </div>
  );
}
