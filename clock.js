// World clock.
// 1. Read a date and time as San Francisco wall-clock time.
// 2. Turn that into one exact moment (a JavaScript Date).
// 3. Ask Intl what that same moment looks like in each city.
// Offsets are never hard-coded. Daylight saving comes from the time zone name.

const SAN_FRANCISCO = "America/Los_Angeles";

// India is listed as Asia/Chennai. Some computers do not have that old name.
// Chennai uses India's only time zone, whose database name is Asia/Kolkata.
const CITIES = [
  { city: "New York", timeZone: "America/New_York" },
  { city: "London", timeZone: "Europe/London" },
  { city: "India", timeZone: "Asia/Chennai" },
  { city: "Malaysia", timeZone: "Asia/Kuala_Lumpur" },
  { city: "Japan", timeZone: "Asia/Tokyo" },
  { city: "Sydney", timeZone: "Australia/Sydney" },
  { city: "Mecca", timeZone: "Asia/Riyadh" },
];

const dateInput = document.querySelector("#sf-date");
const timeInput = document.querySelector("#sf-time");
const nowButton = document.querySelector("#now-button");
const note = document.querySelector("#sf-note");
const form = document.querySelector("#sf-form");

const sanFranciscoCard = createCard(
  { city: "San Francisco", timeZone: SAN_FRANCISCO },
  true
);
document.querySelector("#sf-clock").append(sanFranciscoCard.article);

const cityCards = CITIES.map((city) => {
  const card = createCard(city, false);
  document.querySelector("#cities").append(card.article);
  return card;
});

form.addEventListener("submit", (event) => event.preventDefault());
dateInput.addEventListener("input", render);
timeInput.addEventListener("input", render);
nowButton.addEventListener("click", useCurrentSanFranciscoTime);

// Open the page on the current San Francisco time.
useCurrentSanFranciscoTime();

function pad(number) {
  return String(number).padStart(2, "0");
}

// Intl rejects a time zone name it does not know. Try the requested name first.
function zoneIntlAccepts(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch (error) {
    if (timeZone === "Asia/Chennai") return "Asia/Kolkata";
    throw error;
  }
}

// Hour, minute, second, and calendar date in one time zone.
function numbersInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const value = {};
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value;
  }

  // A few browsers report midnight as hour 24 instead of 00.
  let hour = Number(value.hour);
  if (hour === 24) hour = 0;

  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour,
    minute: Number(value.minute),
    second: Number(value.second),
  };
}

// How far ahead of UTC this zone is, at this exact moment, in milliseconds.
// Example: Pacific Standard Time is 8 hours behind, so this returns -8 hours.
function offsetMs(date, timeZone) {
  const wall = numbersInZone(date, timeZone);
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  );
  return wallAsUtc - date.getTime();
}

function sameWallTime(date, timeZone, wanted) {
  const wall = numbersInZone(date, timeZone);
  return (
    wall.year === wanted.year &&
    wall.month === wanted.month &&
    wall.day === wanted.day &&
    wall.hour === wanted.hour &&
    wall.minute === wanted.minute &&
    wall.second === wanted.second
  );
}

// The pickers give numbers like 2026-11-13 and 21:55, with no time zone.
// Treat those numbers as San Francisco time, then find the real instant.
function instantInSanFrancisco(wanted) {
  const desired = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
    wanted.second
  );

  // The offset can change between the guess and the answer (daylight saving),
  // so correct the guess a few times.
  let guess = desired;
  for (let step = 0; step < 4; step += 1) {
    const next = desired - offsetMs(new Date(guess), SAN_FRANCISCO);
    if (next === guess) break;
    guess = next;
  }

  const instant = new Date(guess);
  const exact = sameWallTime(instant, SAN_FRANCISCO, wanted);

  // In the autumn the same clock time happens twice, one hour apart.
  const oneHour = 60 * 60 * 1000;
  const ambiguous =
    exact &&
    (sameWallTime(new Date(instant.getTime() + oneHour), SAN_FRANCISCO, wanted) ||
      sameWallTime(new Date(instant.getTime() - oneHour), SAN_FRANCISCO, wanted));

  return { instant, exact, ambiguous };
}

function friendlyDate(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function zoneAbbreviation(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName").value;
}

function dayKey(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function readSanFranciscoInput() {
  if (!dateInput.value || !timeInput.value) return null;

  const [year, month, day] = dateInput.value.split("-").map(Number);
  const [hour, minute, second = 0] = timeInput.value.split(":").map(Number);
  const numbers = [year, month, day, hour, minute, second];
  if (numbers.some((number) => Number.isNaN(number))) return null;

  return { year, month, day, hour, minute, second };
}

function render() {
  const wanted = readSanFranciscoInput();
  if (!wanted) {
    note.hidden = true;
    clearCard(sanFranciscoCard);
    for (const card of cityCards) clearCard(card);
    return;
  }

  const result = instantInSanFrancisco(wanted);
  const sfParts = numbersInZone(result.instant, SAN_FRANCISCO);
  paintCard(sanFranciscoCard, result.instant, sfParts, "");
  explainDaylightSaving(wanted, result, sfParts);

  for (const card of cityCards) {
    const parts = numbersInZone(result.instant, card.timeZone);
    const cityDay = dayKey(parts);
    const sfDay = dayKey(sfParts);
    let shift = "";
    if (cityDay > sfDay) shift = "Next day";
    else if (cityDay < sfDay) shift = "Previous day";
    paintCard(card, result.instant, parts, shift);
  }
}

function explainDaylightSaving(wanted, result, shown) {
  const picked = `${pad(wanted.hour)}:${pad(wanted.minute)}`;
  const actual = `${pad(shown.hour)}:${pad(shown.minute)}`;
  const abbr = zoneAbbreviation(result.instant, SAN_FRANCISCO);

  if (!result.exact) {
    note.hidden = false;
    note.textContent =
      `San Francisco skips this hour when daylight saving starts, so ${picked} never happens. Showing ${actual} ${abbr} instead.`;
    return;
  }

  if (result.ambiguous) {
    note.hidden = false;
    note.textContent =
      `This hour happens twice in San Francisco when daylight saving ends. Showing the earlier one (${abbr}).`;
    return;
  }

  note.hidden = true;
  note.textContent = "";
}

function useCurrentSanFranciscoTime() {
  const now = numbersInZone(new Date(), SAN_FRANCISCO);
  dateInput.value = dayKey(now);
  timeInput.value = `${pad(now.hour)}:${pad(now.minute)}:${pad(now.second)}`;
  render();
}

function paintCard(card, instant, parts, shift) {
  card.time.textContent = `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  card.abbr.textContent = zoneAbbreviation(instant, card.timeZone);
  card.date.textContent = friendlyDate(instant, card.timeZone);
  card.shift.textContent = shift;
  card.shift.className = shift === "Next day"
    ? "shift next"
    : shift === "Previous day"
      ? "shift prev"
      : "shift";

  // 12 hours around the clock is 360 degrees, so one hour is 30 degrees.
  // The hour hand also moves as the minutes and seconds pass.
  const hourAngle =
    (parts.hour % 12) * 30 + parts.minute * 0.5 + parts.second * (0.5 / 60);
  const minuteAngle = parts.minute * 6 + parts.second * 0.1;
  const secondAngle = parts.second * 6;
  setHand(card.hands.hour, hourAngle);
  setHand(card.hands.minute, minuteAngle);
  setHand(card.hands.second, secondAngle);
}

function clearCard(card) {
  card.time.textContent = "––:––:––";
  card.abbr.textContent = "";
  card.date.textContent = "Choose a date and a time";
  card.shift.textContent = "";
  card.shift.className = "shift";
  setHand(card.hands.hour, 0);
  setHand(card.hands.minute, 0);
  setHand(card.hands.second, 0);
}

function setHand(hand, angle) {
  // The hand is drawn pointing at 12. Rotate it around the center of the face.
  hand.setAttribute("transform", `rotate(${angle} 50 50)`);
}

function createCard(city, isSource) {
  const timeZone = zoneIntlAccepts(city.timeZone);
  const article = document.createElement("article");
  article.className = "city";
  article.innerHTML = `
    <div class="clock">${clockSvg()}</div>
    <h3>${isSource ? "San Francisco" : city.city}</h3>
    <p class="zone">${timeZone}</p>
    <p class="digital" data-time></p>
    <p class="abbr" data-abbr></p>
    <p class="date" data-date></p>
    <p class="shift" data-shift></p>
  `;

  return {
    article,
    timeZone,
    time: article.querySelector("[data-time]"),
    abbr: article.querySelector("[data-abbr]"),
    date: article.querySelector("[data-date]"),
    shift: article.querySelector("[data-shift]"),
    hands: {
      hour: article.querySelector("[data-hand='hour']"),
      minute: article.querySelector("[data-hand='minute']"),
      second: article.querySelector("[data-hand='second']"),
    },
  };
}

// A round face, hour marks, and three hands. JavaScript only rotates the hands.
function clockSvg() {
  let ticks = "";
  for (let hour = 0; hour < 12; hour += 1) {
    const major = hour % 3 === 0;
    const inner = major ? 11 : 8;
    ticks += `<line class="tick${major ? " major" : ""}" x1="50" y1="5" x2="50" y2="${inner}" transform="rotate(${hour * 30} 50 50)"></line>`;
  }

  return `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="face" cx="50" cy="50" r="48"></circle>
      ${ticks}
      <text x="50" y="18" text-anchor="middle">12</text>
      <text x="82" y="53" text-anchor="middle">3</text>
      <text x="50" y="88" text-anchor="middle">6</text>
      <text x="18" y="53" text-anchor="middle">9</text>
      <line class="hand hour" data-hand="hour" x1="50" y1="50" x2="50" y2="28"></line>
      <line class="hand minute" data-hand="minute" x1="50" y1="50" x2="50" y2="18"></line>
      <line class="hand second" data-hand="second" x1="50" y1="58" x2="50" y2="14"></line>
      <circle class="pin" cx="50" cy="50" r="2.1"></circle>
    </svg>
  `;
}
const API_TOKEN = 'ghp_1dd2432fb48853e57f074629068d22b1de51';
