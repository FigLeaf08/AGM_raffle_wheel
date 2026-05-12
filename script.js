const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const spinBtn = document.getElementById("spinBtn");
const excelFile = document.getElementById("excelFile");
const winnerModal = document.getElementById("winnerModal");
const modalWinnerName = document.getElementById("modalWinnerName");
const modalRemoveBtn = document.getElementById("modalRemoveBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const spinSound = document.getElementById("spinSound");
const winSound = document.getElementById("winSound");

let participants = [];
let lastWinner = null;

let workbook = null;
let worksheet = null;
let excelData = [];

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

    workbook = XLSX.read(data, {
      type: "array",
    });

    worksheet = workbook.Sheets[workbook.SheetNames[0]];

    excelData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    });

    // Skip header row
    participants = excelData
      .slice(1)
      .filter((r) => r.length > 0 && r[1])
      .map((r, index) => ({
        rowIndex: index + 1,
        id: r[0],
        name: String(r[1]),
        passbook: r[2],
        contact: r[3],
        raffle: r[4],
        winner: r[5],
        weight: 1,
      }));

    totalWeight = participants.length;

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

  spinSound.loop = true;
  spinSound.currentTime = 0;
  spinSound.play();

  // pick REAL winner first
  pickWinnerInternal();

  let duration = 16000;

  let start = performance.now();

  let extraRotation = Math.random() * 360 + 2500;

  function animate(time) {
    let progress = Math.min((time - start) / duration, 1);

    let ease = 1 - Math.pow(1 - progress, 4);

    angle = (extraRotation * ease * Math.PI) / 180;
    canvas.style.filter = progress < 1 ? "blur(1px)" : "blur(0px)";

    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      spinSound.pause();
      spinSound.currentTime = 0;

      showWinnerModal(lastWinner.name);

      markWinnerInExcel(lastWinner);

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

  lastWinner = null;

  drawWheel();
}

function markWinnerInExcel(winner) {
  // Winner column = column E
  const winnerCell = "E" + (winner.rowIndex + 1);

  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  worksheet[winnerCell] = {
    t: "s",
    v: timestamp,
  };
}

function downloadUpdatedExcel() {
  const updatedWorkbook = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([updatedWorkbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  link.download = `HRCU_AGM_Raffle_Results_${timestamp}.xlsx`;

  link.click();
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

/* ---------------------------
   SHOW WINNER MODAL
----------------------------*/
function showWinnerModal(name) {
  modalWinnerName.textContent = name;

  winSound.currentTime = 0;
  winSound.play();

  winnerModal.classList.add("show");
}

/* ---------------------------
   CLOSE MODAL
----------------------------*/
function closeWinnerModal() {
  winnerModal.classList.remove("show");
}

/* ---------------------------
   MODAL EVENTS
----------------------------*/
closeModalBtn.onclick = closeWinnerModal;

winnerModal.onclick = (e) => {
  if (e.target === winnerModal) {
    closeWinnerModal();
  }
};

/* ---------------------------
   REMOVE WINNER FROM MODAL
----------------------------*/
modalRemoveBtn.onclick = () => {
  removeWinner();

  closeWinnerModal();
};
