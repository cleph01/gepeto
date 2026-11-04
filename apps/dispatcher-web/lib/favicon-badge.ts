// Draws the unread count onto the browser tab's icon, so it can be seen from
// other tabs, including pinned ones that hide the title. The links keep their
// original href in a data attribute so the plain icon can be put back.

const SIZE = 64;
let drawId = 0;

function iconLinks() {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
  for (const link of links) {
    if (!link.dataset.originalHref) link.dataset.originalHref = link.href;
  }
  return links;
}

export function setFaviconBadge(count: number) {
  const id = ++drawId; // a newer count wins over a draw still loading its image
  const links = iconLinks();
  if (links.length === 0) return;

  if (count <= 0) {
    for (const link of links) link.href = link.dataset.originalHref!;
    return;
  }

  const image = new Image();
  image.onload = () => {
    if (id !== drawId) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(image, 0, 0, SIZE, SIZE);

    // Large, because a tab icon only shows at about 16px.
    const label = count > 9 ? "9+" : String(count);
    const radius = 22;
    const center = SIZE - radius;
    ctx.beginPath();
    ctx.arc(center, radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#D93025";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${label.length > 1 ? 26 : 32}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, center, radius + 2);

    const badged = canvas.toDataURL("image/png");
    for (const link of links) link.href = badged;
  };
  image.src = links[0].dataset.originalHref!;
}
