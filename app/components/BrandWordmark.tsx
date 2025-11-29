import React from "react";

type Brand = "pocket" | "pulse";
type Mode = "light" | "dark";

interface BrandWordmarkProps {
  brand: Brand;
  mode?: Mode;
  className?: string;
  showBadge?: boolean;
}

/**
 * Renders the Pocket Manager5 or Pulse Check5 wordmark using the Fredoka
 * “comic-style” font with a red "5" badge. Supports light and dark modes.
 */
export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  brand,
  mode = "light",
  className = "",
  showBadge = true,
}) => {
  const baseClasses = [
    "brand-wordmark",
    `brand-wordmark--${mode}`,
    `brand-wordmark--${brand}`,
    showBadge ? "" : "brand-wordmark--no-badge",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const badge = showBadge ? <span className="brand-wordmark__badge">5</span> : null;

  if (brand === "pocket") {
    return (
      <span className={baseClasses} aria-label="Pocket Manager 5">
        {badge}
        <span className="brand-wordmark__line">
          <span className="brand-wordmark__p-red">P</span>ocket
        </span>
        <span className="brand-wordmark__line">Manager</span>
      </span>
    );
  }

  return (
    <span className={baseClasses} aria-label="Pulse Check 5">
      {badge}
      <span className="brand-wordmark__line">
        <span className="brand-wordmark__p-red">P</span>ulse
      </span>
      <span className="brand-wordmark__line">Check</span>
    </span>
  );
};
