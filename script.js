const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const spinBtn = document.getElementById("spinBtn");
const winnerDiv = document.getElementById("winner");
const excelFile = document.getElementById("excelFile");

let participants = [];
let lastWinner = null;

let angle = 0;
let spinning = false;

let totalWeight = 0;

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 375;

const colors = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

const MAX_VISIBLE_SLICES = 300;

/* ---------------------------
   EXCEL IMPORT
----------------------------*/
excelFile.onchange = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = (event) => {
    const data = new Uint8Array(event.target.result);

    const wb = XLSX.read(data, {
      type: "array",
    });

    const sheet = wb.Sheets[wb.SheetNames[0]];

    const json = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
    });

    participants = json
      .filter((r) => r.length > 0 && r[0])
      .map((r) => ({
        name: String(r[0]),
        weight: r[1] ? Number(r[1]) : 1,
      }));

    totalWeight = participants.reduce((a, b) => a + b.weight, 0);

    drawWheel();
  };

  reader.readAsArrayBuffer(file);
};

/* ---------------------------
   GET DISPLAY SLICES
----------------------------*/
function getDisplaySlices() {
  if (participants.length <= MAX_VISIBLE_SLICES) {
    return participants.map((p) => ({
      label: p.name,
      weight: p.weight,
      realParticipants: [p],
    }));
  }

  const step = Math.ceil(participants.length / MAX_VISIBLE_SLICES);

  let slices = [];

  for (let i = 0; i < participants.length; i += step) {
    const group = participants.slice(i, i + step);

    slices.push({
      label: group[0].name,
      weight: group.reduce((a, b) => a + b.weight, 0),
      realParticipants: group,
    });
  }

  return slices;
}

/* ---------------------------
   DRAW WHEEL
----------------------------*/
function drawWheel(highlightWinner = false) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  if (!participants.length) return;

  const slices = getDisplaySlices();

  const displayWeight = slices.reduce((a, b) => a + b.weight, 0);

  let startAngle = angle;

  slices.forEach((sliceObj, i) => {
    const slice = (sliceObj.weight / displayWeight) * (2 * Math.PI);

    const endAngle = startAngle + slice;

    const containsWinner =
      highlightWinner &&
      lastWinner &&
      sliceObj.realParticipants.includes(lastWinner);

    // slice
    ctx.beginPath();

    ctx.moveTo(centerX, centerY);

    ctx.arc(centerX, centerY, radius, startAngle, endAngle);

    ctx.closePath();

    ctx.fillStyle = colors[i % colors.length];

    ctx.fill();

    // winner glow
    if (containsWinner) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 25;
    }

    ctx.lineWidth = containsWinner ? 5 : 2;

    ctx.strokeStyle = containsWinner ? "#ffffff" : "white";

    ctx.stroke();

    ctx.shadowBlur = 0;

    startAngle = endAngle;
  });

  // CENTER CIRCLE
  ctx.beginPath();

  ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);

  ctx.fillStyle = "#111827";

  ctx.fill();

  // POINTER (DOWNWARD)
  ctx.fillStyle = "#facc15";

  ctx.beginPath();

  ctx.moveTo(centerX, centerY - radius + 10);

  ctx.lineTo(centerX - 15, centerY - radius - 20);

  ctx.lineTo(centerX + 15, centerY - radius - 20);

  ctx.closePath();

  ctx.fill();
}

/* ---------------------------
   SPIN
----------------------------*/
spinBtn.onclick = () => {
  if (spinning || !participants.length) return;

  spinning = true;

  winnerDiv.textContent = "";

  // pick REAL winner first
  pickWinnerInternal();

  let duration = 5500;

  let start = performance.now();

  let extraRotation = Math.random() * 360 + 2500;

  function animate(time) {
    let progress = Math.min((time - start) / duration, 1);

    let ease = 1 - Math.pow(1 - progress, 4);

    angle = (extraRotation * ease * Math.PI) / 180;

    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;

      winnerDiv.textContent = "🏆 Winner: " + lastWinner.name;

      drawWheel(true);

      launchConfetti();
    }
  }

  requestAnimationFrame(animate);
};

/* ---------------------------
   PICK REAL WINNER
----------------------------*/
function pickWinnerInternal() {
  let r = Math.random() * totalWeight;

  let sum = 0;

  for (let p of participants) {
    sum += p.weight;

    if (r <= sum) {
      lastWinner = p;
      return;
    }
  }
}

/* ---------------------------
   REMOVE WINNER
----------------------------*/
function removeWinner() {
  if (!lastWinner) return;

  participants = participants.filter((p) => p !== lastWinner);

  totalWeight = participants.reduce((a, b) => a + b.weight, 0);

  winnerDiv.textContent = "✔ Winner removed";

  lastWinner = null;

  drawWheel();
}

/* ---------------------------
   CONFETTI
----------------------------*/
function launchConfetti() {
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("div");

    c.style.position = "fixed";

    c.style.left = Math.random() * 100 + "vw";

    c.style.top = "0";

    c.style.width = "6px";

    c.style.height = "6px";

    c.style.background = colors[Math.floor(Math.random() * colors.length)];

    c.style.zIndex = 9999;

    document.body.appendChild(c);

    let duration = Math.random() * 2000 + 2000;

    c.animate(
      [
        {
          transform: "translateY(0)",
        },
        {
          transform: "translateY(100vh)",
        },
      ],
      { duration },
    );

    setTimeout(() => c.remove(), duration);
  }
}

/* ---------------------------
   FULLSCREEN
----------------------------*/
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

/* ---------------------------
   INIT
----------------------------*/
drawWheel();
