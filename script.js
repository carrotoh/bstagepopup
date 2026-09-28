// =====================================================
// SUPABASE
// =====================================================

const SUPABASE_URL = "https://exrycjlaxujavlwdwdht.supabase.co";
const SUPABASE_KEY =
  "sb_publishable_iytGd8AiezeBUUM9XDfDCw_GCYUKy-c";

const guestbookDb =
  window.supabase &&
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_KEY.startsWith("sb_publishable_")
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      )
    : null;


// =====================================================
// DOM
// =====================================================

const guestForm =
  document.getElementById("guestForm");

const guestInput =
  document.getElementById("guestInput");

const guestSubmitBtn =
  document.getElementById("guestSubmitBtn");

const charCount =
  document.getElementById("charCount");

const floatingBoard =
  document.getElementById("floatingBoard");

const messageModal =
  document.getElementById("messageModal");

const messageFullText =
  document.getElementById("messageFullText");

const canvas =
  document.getElementById("confettiCanvas");

const ctx =
  canvas ? canvas.getContext("2d") : null;


// =====================================================
// STATE
// =====================================================

const shownMessageIds = new Set();

let particles = [];

let confettiAnimationId = null;

let guestbookChannel = null;


// =====================================================
// 글자수
// =====================================================

if (guestInput && charCount) {
  guestInput.addEventListener("input", () => {
    charCount.textContent =
      `${guestInput.value.length} / 100`;
  });
}


// =====================================================
// 방명록 저장
// =====================================================

if (guestForm) {
  guestForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const text =
        guestInput.value.trim();

      if (!text) {
        guestInput.focus();
        return;
      }

      if (!guestbookDb) {
        alert(
          "Supabase 연결에 실패했습니다."
        );
        return;
      }

      guestSubmitBtn.disabled = true;

      try {

        const { data, error } =
          await guestbookDb
            .from("guestbook_messages")
            .insert({
              message: text
            })
            .select(
              "id, message, created_at"
            )
            .single();


        if (error) {
          throw error;
        }


        // 저장된 메시지 즉시 표시
        showSavedMessage(
          data,
          true
        );


        // 입력창 초기화
        guestInput.value = "";

        charCount.textContent =
          "0 / 100";


        // 컨페티
        triggerConfetti();


      } catch (error) {

        console.error(
          "방명록 저장 오류:",
          error
        );

        alert(
          `방명록 저장 오류: ${
            error.message ||
            "다시 시도해주세요."
          }`
        );

      } finally {

        guestSubmitBtn.disabled =
          false;

      }
    }
  );
}


// =====================================================
// DB에 저장된 방명록 불러오기
// =====================================================

async function connectGuestbook() {

  if (!guestbookDb) {

    console.error(
      "Supabase 클라이언트를 생성하지 못했습니다."
    );

    return;
  }


  console.log(
    "방명록 DB 불러오기 시작"
  );


  try {

    const { data, error } =
      await guestbookDb
        .from("guestbook_messages")
        .select(
          "id, message, created_at"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(50);


    if (error) {
      throw error;
    }


    console.log(
      "불러온 방명록:",
      data
    );


    // 최신 50개를
    // 오래된 순서 → 최신 순서로 표시
    const messages =
      (data || []).reverse();


    messages.forEach(
      (row) => {

        showSavedMessage(
          row,
          false
        );

      }
    );


  } catch (error) {

    console.error(
      "방명록 불러오기 오류:",
      error
    );

  }


  // ---------------------------------
  // 실시간 새 메시지 수신
  // ---------------------------------

  if (guestbookChannel) {

    await guestbookDb
      .removeChannel(
        guestbookChannel
      );

  }


  guestbookChannel =
    guestbookDb
      .channel(
        "guestbook-live"
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table:
            "guestbook_messages"
        },
        (payload) => {

          showSavedMessage(
            payload.new,
            true
          );

        }
      )
      .subscribe(
        (status) => {

          console.log(
            "Supabase realtime:",
            status
          );

        }
      );
}


// =====================================================
// 중복 메시지 방지
// =====================================================

function showSavedMessage(
  row,
  isNew = false
) {

  if (!row) {
    return;
  }


  if (
    row.id !== undefined &&
    row.id !== null
  ) {

    if (
      shownMessageIds.has(
        String(row.id)
      )
    ) {
      return;
    }


    shownMessageIds.add(
      String(row.id)
    );

  }


  renderMessage(
    row.message,
    isNew
  );
}


// =====================================================
// 플로팅 메시지
// =====================================================

function renderMessage(
  text,
  isNew = false
) {

  if (
    !floatingBoard ||
    !text
  ) {
    return;
  }


  const laneCount = 6;


  // ---------------------------------
  // 레인이 없다면 최초 1회 생성
  // ---------------------------------

  let lanes =
    floatingBoard.querySelectorAll(
      ".floating-lane"
    );


  if (
    lanes.length !== laneCount
  ) {

    floatingBoard.innerHTML = "";


    for (
      let i = 0;
      i < laneCount;
      i++
    ) {

      const lane =
        document.createElement(
          "div"
        );

      lane.className =
        "floating-lane";

      lane.dataset.lane =
        String(i);


      const track =
        document.createElement(
          "div"
        );

      track.className =
        "floating-track";


      lane.appendChild(
        track
      );

      floatingBoard.appendChild(
        lane
      );
    }


    lanes =
      floatingBoard.querySelectorAll(
        ".floating-lane"
      );
  }


  // ---------------------------------
  // 가장 메시지가 적은 레인 선택
  // ---------------------------------

  let targetLane =
    lanes[0];

  let minCount =
    Infinity;


  lanes.forEach(
    (lane) => {

      const track =
        lane.querySelector(
          ".floating-track"
        );


      const count =
        track
          ? track.children.length
          : 0;


      if (
        count < minCount
      ) {

        minCount =
          count;

        targetLane =
          lane;
      }

    }
  );


  const track =
    targetLane.querySelector(
      ".floating-track"
    );


  if (!track) {
    return;
  }


  // ---------------------------------
  // 말풍선 생성
  // ---------------------------------

  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";

  button.className =
    "floating-item";


  const characters =
    Array.from(text);


  button.textContent =
    characters
      .slice(0, 12)
      .join("") +
    (
      characters.length > 12
        ? "…"
        : ""
    );


  button.setAttribute(
    "aria-label",
    `방명록 전문 보기: ${text}`
  );


  // ---------------------------------
  // 클릭 → 전문 모달
  // ---------------------------------

  button.addEventListener(
    "click",
    () => {

      if (
        !messageModal ||
        !messageFullText
      ) {
        return;
      }


      messageFullText.textContent =
        text;


      messageModal.classList.add(
        "is-open"
      );


      messageModal.setAttribute(
        "aria-hidden",
        "false"
      );

    }
  );


  track.appendChild(
    button
  );
}


// =====================================================
// 메시지 모달
// =====================================================

function closeMessageModal() {

  if (!messageModal) {
    return;
  }


  messageModal.classList.remove(
    "is-open"
  );


  messageModal.setAttribute(
    "aria-hidden",
    "true"
  );
}


if (messageModal) {

  messageModal.addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        messageModal
      ) {

        closeMessageModal();

      }

    }
  );

}


document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape"
    ) {

      closeMessageModal();

    }

  }
);


// =====================================================
// CONFETTI
// =====================================================

function resizeCanvas() {

  if (
    !canvas ||
    !ctx
  ) {
    return;
  }


  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );


  canvas.width =
    Math.round(
      window.innerWidth * dpr
    );


  canvas.height =
    Math.round(
      window.innerHeight * dpr
    );


  canvas.style.width =
    `${window.innerWidth}px`;


  canvas.style.height =
    `${window.innerHeight}px`;


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );
}


// =====================================================
// canvas 완전 삭제
// =====================================================

function clearConfettiCanvas() {

  if (
    !canvas ||
    !ctx
  ) {
    return;
  }


  ctx.save();


  // DPR transform 제거
  ctx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  ctx.restore();
}


// =====================================================
// 컨페티 시작
// =====================================================

function triggerConfetti() {

  if (
    !canvas ||
    !ctx
  ) {
    return;
  }


  // 기존 animation 종료
  if (
    confettiAnimationId !== null
  ) {

    cancelAnimationFrame(
      confettiAnimationId
    );


    confettiAnimationId =
      null;
  }


  clearConfettiCanvas();


  particles = [];


  const originX =
    window.innerWidth / 2;


  // 입력창/버튼 근처에서 터지게
  const originY =
    Math.min(
      window.innerHeight * 0.72,
      window.innerHeight - 120
    );


  for (
    let i = 0;
    i < 70;
    i++
  ) {

    particles.push({

      x: originX,

      y: originY,

      vx:
        (Math.random() - 0.5) *
        13,

      vy:
        -(
          Math.random() * 10 +
          5
        ),

      gravity:
        0.32 +
        Math.random() * 0.12,

      size:
        Math.random() * 7 +
        5,

      rotation:
        Math.random() * 360,

      rotSpeed:
        (Math.random() - 0.5) *
        12,

      color: [
        "#ff4757",
        "#2ed573",
        "#1e90ff",
        "#ffa502",
        "#9b59b6"
      ][
        Math.floor(
          Math.random() * 5
        )
      ]

    });

  }


  confettiAnimationId =
    requestAnimationFrame(
      updateConfetti
    );
}


// =====================================================
// 컨페티 애니메이션
// =====================================================

function updateConfetti() {

  if (
    !canvas ||
    !ctx
  ) {
    return;
  }


  clearConfettiCanvas();


  particles.forEach(
    (particle) => {

      particle.x +=
        particle.vx;


      particle.y +=
        particle.vy;


      particle.vy +=
        particle.gravity;


      particle.rotation +=
        particle.rotSpeed;


      ctx.save();


      ctx.translate(
        particle.x,
        particle.y
      );


      ctx.rotate(
        particle.rotation *
        Math.PI /
        180
      );


      ctx.fillStyle =
        particle.color;


      ctx.fillRect(
        -particle.size / 2,
        -particle.size / 4,
        particle.size,
        particle.size / 2
      );


      ctx.restore();

    }
  );


  // 화면 밖으로 완전히 나간 것만 삭제
  particles =
    particles.filter(
      (particle) => {

        return (
          particle.y <
            window.innerHeight +
              100 &&

          particle.x >
            -150 &&

          particle.x <
            window.innerWidth +
              150
        );

      }
    );


  if (
    particles.length > 0
  ) {

    confettiAnimationId =
      requestAnimationFrame(
        updateConfetti
      );

  } else {

    confettiAnimationId =
      null;


    // 마지막 프레임 잔상 제거
    clearConfettiCanvas();

  }
}


// =====================================================
// RESIZE
// =====================================================

window.addEventListener(
  "resize",
  () => {

    resizeCanvas();

    // 화면 회전/리사이즈 시
    // 컨페티 잔상 제거
    if (
      particles.length === 0
    ) {

      clearConfettiCanvas();

    }

  }
);


// =====================================================
// 페이지 초기 실행
// =====================================================
// =====================================================
// 방문자 카운터
// =====================================================

async function countVisit() {

  const visitorCount =
    document.getElementById("visitorCount");

  if (!visitorCount || !guestbookDb) {
    return;
  }

  try {

    const { data, error } =
      await guestbookDb.rpc(
        "increment_visit_count"
      );

    if (error) {
      throw error;
    }

    visitorCount.textContent =
      Number(data).toLocaleString("ko-KR");

  } catch (error) {

    console.error(
      "방문자 카운트 오류:",
      error
    );

    visitorCount.textContent = "-";
  }
}

async function initPage() {

  if (
    guestInput &&
    charCount
  ) {

    charCount.textContent =
      `${guestInput.value.length} / 100`;

  }

  resizeCanvas();

  // 방문 횟수 +1
  countVisit();

  // 방명록 불러오기
  await connectGuestbook();
}

// script가 body 끝에 있어도,
// 혹시 DOM 로드 전에 실행되는 경우까지 대응
if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initPage,
    {
      once: true
    }
  );

} else {

  initPage();

}

// =====================================================
// CARD MAKER V3
// 원본 / 드로잉 / 텍스트 완전 분리
// 통합 UNDO
// 텍스트 터치 수정 / 드래그 / 핀치 확대축소
// =====================================================

const cardStartBtn = document.getElementById("cardStartBtn");
const cardSelectModal = document.getElementById("cardSelectModal");
const cardSelectClose = document.getElementById("cardSelectClose");
const cardGrid = document.getElementById("cardGrid");

const cardEditorModal = document.getElementById("cardEditorModal");
const cardEditorClose = document.getElementById("cardEditorClose");

const cardStage = document.getElementById("cardStage");
const cardBaseImage = document.getElementById("cardBaseImage");

const drawingCanvas = document.getElementById("drawingCanvas");
const drawingCtx = drawingCanvas
  ? drawingCanvas.getContext("2d")
  : null;

const textLayer = document.getElementById("textLayer");

const brushSize = document.getElementById("brushSize");
const brushSizeValue = document.getElementById("brushSizeValue");

const eraserBtn = document.getElementById("eraserBtn");
const undoDrawingBtn = document.getElementById("undoDrawingBtn");
const resetDrawingBtn = document.getElementById("resetDrawingBtn");

const addCardTextBtn = document.getElementById("addCardTextBtn");
const completeCardBtn = document.getElementById("completeCardBtn");

const cardCompleteModal =
  document.getElementById("cardCompleteModal");

const cardCompleteClose =
  document.getElementById("cardCompleteClose");

const completedCardPreview =
  document.getElementById("completedCardPreview");

const copyShareTextBtn =
  document.getElementById("copyShareTextBtn");

const shareCopyText =
  document.getElementById("shareCopyText");

const saveCardBtn =
  document.getElementById("saveCardBtn");


// =====================================================
// STATE
// =====================================================

let selectedCardUrl = null;

let currentColor = "#ffffff";
let currentBrushSize = 8;

let eraserMode = false;

let drawingPointerId = null;
let isDrawing = false;
let currentStroke = null;

/*
  실제 드로잉 데이터.
  이미지 스냅샷을 히스토리에 저장하지 않고
  stroke 데이터만 저장해서 모바일 메모리 절약.
*/
let strokes = [];

/*
  텍스트 객체 데이터
*/
let textObjects = [];

let selectedTextId = null;
let nextTextId = 1;

/*
  모든 작업 통합 히스토리
*/
let cardHistory = [];

let restoringHistory = false;

let completedCardBlob = null;
let completedCardBlobUrl = null;


// =====================================================
// UTIL
// =====================================================

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}


function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


function getDistance(a, b) {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y
  );
}


function syncBodyLock() {

  const hasOpenModal =
    document.querySelector(
      ".card-maker-modal.is-open"
    );

  document.body.classList.toggle(
    "card-modal-open",
    Boolean(hasOpenModal)
  );
}


// =====================================================
// MODAL
// =====================================================

function openCardModal(modal) {

  if (!modal) return;

  modal.classList.add("is-open");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  syncBodyLock();
}


function closeCardModal(modal) {

  if (!modal) return;

  modal.classList.remove("is-open");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  syncBodyLock();
}


// =====================================================
// 카드 목록
// =====================================================

async function loadCardImages() {

  if (!cardGrid) return;

  if (!guestbookDb) {

    cardGrid.innerHTML =
      `<p class="card-loading">Supabase 연결에 실패했습니다.</p>`;

    return;
  }

  cardGrid.innerHTML =
    `<p class="card-loading">카드를 불러오는 중...</p>`;

  try {

    const { data, error } =
      await guestbookDb
        .from("card_images")
        .select(
          "id, image_url, sort_order"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );

    if (error) {
      throw error;
    }

    cardGrid.innerHTML = "";

    if (!data || data.length === 0) {

      cardGrid.innerHTML =
        `<p class="card-loading">등록된 카드가 없습니다.</p>`;

      return;
    }

    data.forEach((card) => {

      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "card-thumbnail";

      const image =
        document.createElement("img");

      image.src = card.image_url;
      image.alt = "축하카드 디자인";
      image.loading = "lazy";
      image.draggable = false;

      button.appendChild(image);

      button.addEventListener(
        "click",
        () => {

          openCardEditor(
            card.image_url
          );
        }
      );

      cardGrid.appendChild(button);
    });

  } catch (error) {

    console.error(
      "카드 목록 불러오기 오류:",
      error
    );

    cardGrid.innerHTML =
      `<p class="card-loading">카드를 불러오지 못했습니다.</p>`;
  }
}


// =====================================================
// START
// =====================================================

cardStartBtn?.addEventListener(
  "click",
  async () => {

    openCardModal(
      cardSelectModal
    );

    await loadCardImages();
  }
);


cardSelectClose?.addEventListener(
  "click",
  () => {

    closeCardModal(
      cardSelectModal
    );
  }
);


cardEditorClose?.addEventListener(
  "click",
  () => {

    finishTextEditing();

    closeCardModal(
      cardEditorModal
    );
  }
);


cardCompleteClose?.addEventListener(
  "click",
  () => {

    closeCardModal(
      cardCompleteModal
    );
  }
);


// =====================================================
// 이미지 로딩
// =====================================================

function loadImage(src) {

  return new Promise(
    (resolve, reject) => {

      const image = new Image();

      image.crossOrigin = "anonymous";

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            "이미지를 불러오지 못했습니다."
          )
        );
      };

      image.src = src;
    }
  );
}


// =====================================================
// EDITOR OPEN
// =====================================================

async function openCardEditor(imageUrl) {

  if (
    !drawingCanvas ||
    !drawingCtx ||
    !cardBaseImage ||
    !cardStage ||
    !textLayer
  ) {

    console.error(
      "카드 에디터 DOM을 찾을 수 없습니다."
    );

    return;
  }

  try {

    const image =
      await loadImage(imageUrl);

    selectedCardUrl = imageUrl;

    /*
      원본은 IMG 레이어
    */
    cardBaseImage.src = imageUrl;

    /*
      드로잉 canvas는 원본 이미지 해상도
    */
    drawingCanvas.width =
      image.naturalWidth;

    drawingCanvas.height =
      image.naturalHeight;

    /*
      stage 비율을 원본과 동일하게
    */
    cardStage.style.aspectRatio =
      `${image.naturalWidth} / ${image.naturalHeight}`;

    /*
      원본 IMG가 stage 전체를 채우게
    */
    cardBaseImage.style.width = "100%";
    cardBaseImage.style.height = "100%";
    cardBaseImage.style.objectFit = "contain";

    resetEditorState();

    closeCardModal(
      cardSelectModal
    );

    openCardModal(
      cardEditorModal
    );

    /*
      레이아웃 완료 후 렌더링
    */
    requestAnimationFrame(() => {

      renderDrawing();
      renderTexts();

      saveHistory(true);
    });

  } catch (error) {

    console.error(
      "카드 이미지 오류:",
      error
    );

    alert(
      "카드 이미지를 불러오지 못했습니다."
    );
  }
}


// =====================================================
// EDITOR RESET STATE
// =====================================================

function resetEditorState() {

  strokes = [];
  textObjects = [];

  selectedTextId = null;
  nextTextId = 1;

  cardHistory = [];

  isDrawing = false;
  currentStroke = null;
  drawingPointerId = null;

  eraserMode = false;

  eraserBtn?.classList.remove(
    "active"
  );

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  textLayer.innerHTML = "";
}


// =====================================================
// DRAWING 좌표
// =====================================================

function getCanvasPoint(event) {

  const rect =
    drawingCanvas.getBoundingClientRect();

  if (
    rect.width === 0 ||
    rect.height === 0
  ) {

    return {
      x: 0,
      y: 0
    };
  }

  return {

    x:
      (
        event.clientX -
        rect.left
      ) *
      (
        drawingCanvas.width /
        rect.width
      ),

    y:
      (
        event.clientY -
        rect.top
      ) *
      (
        drawingCanvas.height /
        rect.height
      )
  };
}


function getCanvasScale() {

  const rect =
    drawingCanvas.getBoundingClientRect();

  if (!rect.width) {
    return 1;
  }

  return (
    drawingCanvas.width /
    rect.width
  );
}


// =====================================================
// DRAWING RENDER
// =====================================================

function renderDrawing() {

  if (
    !drawingCanvas ||
    !drawingCtx
  ) {
    return;
  }

  drawingCtx.save();

  drawingCtx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  drawingCtx.globalCompositeOperation =
    "source-over";

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  drawingCtx.restore();


  strokes.forEach((stroke) => {

    drawStroke(stroke);
  });
}


function drawStroke(stroke) {

  if (
    !stroke ||
    !stroke.points ||
    stroke.points.length === 0
  ) {
    return;
  }

  drawingCtx.save();

  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  drawingCtx.lineWidth =
    stroke.size;

  if (stroke.erase) {

    /*
      ★ 중요
      이 canvas에는 낙서밖에 없으므로
      원본 이미지와 텍스트는 절대 안 지워짐.
    */
    drawingCtx.globalCompositeOperation =
      "destination-out";

  } else {

    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.strokeStyle =
      stroke.color;
  }


  /*
    점만 찍은 경우
  */
  if (stroke.points.length === 1) {

    const point =
      stroke.points[0];

    drawingCtx.beginPath();

    drawingCtx.arc(
      point.x,
      point.y,
      stroke.size / 2,
      0,
      Math.PI * 2
    );

    if (stroke.erase) {

      drawingCtx.fillStyle =
        "rgba(0,0,0,1)";

    } else {

      drawingCtx.fillStyle =
        stroke.color;
    }

    drawingCtx.fill();

    drawingCtx.restore();

    return;
  }


  drawingCtx.beginPath();

  drawingCtx.moveTo(
    stroke.points[0].x,
    stroke.points[0].y
  );


  for (
    let i = 1;
    i < stroke.points.length;
    i++
  ) {

    const point =
      stroke.points[i];

    drawingCtx.lineTo(
      point.x,
      point.y
    );
  }

  drawingCtx.stroke();

  drawingCtx.restore();
}


// =====================================================
// DRAWING POINTER
// =====================================================

function startDrawing(event) {

  /*
    ★ 텍스트가 선택되어 있으면
    이번 터치에서는 절대 브러시 시작 안 함.
  */
  if (selectedTextId !== null) {
    return;
  }

  /*
    마우스 우클릭 방지
  */
  if (
    event.pointerType === "mouse" &&
    event.button !== 0
  ) {
    return;
  }

  event.preventDefault();

  const point =
    getCanvasPoint(event);

  const canvasScale =
    getCanvasScale();

  currentStroke = {

    color:
      currentColor,

    size:
      currentBrushSize *
      canvasScale,

    erase:
      eraserMode,

    points: [
      point
    ]
  };

  isDrawing = true;

  drawingPointerId =
    event.pointerId;

  drawingCanvas.setPointerCapture?.(
    event.pointerId
  );

  strokes.push(
    currentStroke
  );

  renderDrawing();
}
function moveDrawing(event) {

  if (
    !isDrawing ||
    drawingPointerId !==
      event.pointerId ||
    !currentStroke
  ) {
    return;
  }

  event.preventDefault();

  const point =
    getCanvasPoint(event);

  currentStroke.points.push(
    point
  );

  /*
    전체 다시 그려도 카드 1장 규모에서는 충분히 빠름.
    대신 history가 매우 안정적임.
  */
  renderDrawing();
}


function stopDrawing(event) {

  if (
    !isDrawing ||
    drawingPointerId !==
      event.pointerId
  ) {
    return;
  }

  event.preventDefault();

  isDrawing = false;
  drawingPointerId = null;
  currentStroke = null;

  try {

    drawingCanvas.releasePointerCapture?.(
      event.pointerId
    );

  } catch (error) {
    // ignore
  }

  saveHistory();
}


drawingCanvas?.addEventListener(
  "pointerdown",
  startDrawing
);

drawingCanvas?.addEventListener(
  "pointermove",
  moveDrawing
);

drawingCanvas?.addEventListener(
  "pointerup",
  stopDrawing
);

drawingCanvas?.addEventListener(
  "pointercancel",
  stopDrawing
);


// =====================================================
// COLOR
// =====================================================

document
  .querySelectorAll(".color-btn")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const color =
          button.dataset.color;

        if (!color) return;

        currentColor = color;

        /*
          색 누르면 지우개 해제
        */
        eraserMode = false;

        eraserBtn?.classList.remove(
          "active"
        );


        document
          .querySelectorAll(
            ".color-btn"
          )
          .forEach((item) => {

            item.classList.remove(
              "active"
            );
          });


        button.classList.add(
          "active"
        );


        /*
          선택된 텍스트가 있으면
          그 텍스트 색상 변경.
        */
        if (selectedTextId !== null) {

          const textObject =
            getTextObject(
              selectedTextId
            );

          if (textObject) {

            const oldColor =
              textObject.color;

            if (oldColor !== color) {

              textObject.color =
                color;

              renderTexts();

              selectText(
                textObject.id
              );

              saveHistory();
            }
          }
        }
      }
    );
  });


// =====================================================
// BRUSH SIZE
// =====================================================

brushSize?.addEventListener(
  "input",
  () => {

    currentBrushSize =
      Number(
        brushSize.value
      );

    if (brushSizeValue) {

      brushSizeValue.textContent =
        String(
          currentBrushSize
        );
    }
  }
);


// =====================================================
// ERASER
// =====================================================

eraserBtn?.addEventListener(
  "click",
  () => {

    eraserMode =
      !eraserMode;

    eraserBtn.classList.toggle(
      "active",
      eraserMode
    );

    finishTextEditing();
    deselectText();
  }
);


// =====================================================
// TEXT DATA
// =====================================================

function getTextObject(id) {

  return textObjects.find(
    (item) =>
      item.id === Number(id)
  );
}


function getTextElement(id) {

  return textLayer?.querySelector(
    `[data-text-id="${id}"]`
  );
}


// =====================================================
// TEXT ADD
// =====================================================

addCardTextBtn?.addEventListener(
  "click",
  () => {

    finishTextEditing();

const textObject = {

  id:
    nextTextId++,

  text:
    "",

  x:
    50,

  y:
    50,

  scale:
    1,

  color:
    currentColor,

  /*
    ★ 텍스트별 정렬값
  */
  align:
    "center"
};

    textObjects.push(
      textObject
    );

    selectedTextId =
      textObject.id;

    renderTexts();

    saveHistory();

    requestAnimationFrame(
      () => {

        startTextEditing(
          textObject.id,
          true
        );
      }
    );
  }
);


// =====================================================
// TEXT RENDER
// =====================================================

function renderTexts() {

  if (!textLayer) return;

  textLayer.innerHTML = "";

  textObjects.forEach(
    (textObject) => {

      /*
        예전 history 데이터에
        align이 없는 경우 대응
      */
      if (!textObject.align) {

        textObject.align =
          "center";
      }


      const item =
        document.createElement(
          "div"
        );

      item.className =
        "card-text-item";

      item.dataset.textId =
        String(
          textObject.id
        );

      item.style.left =
        `${textObject.x}%`;

      item.style.top =
        `${textObject.y}%`;

      item.style.color =
        textObject.color;

      /*
        ★ 좌 / 중앙 / 우 정렬
      */
      item.style.textAlign =
        textObject.align;

      /*
        ★ 자동 줄바꿈 금지
        사용자가 직접 Enter한 줄바꿈만 유지
      */
      item.style.whiteSpace =
        "pre";

      item.style.width =
        "max-content";

      item.style.maxWidth =
        "none";

      item.style.wordBreak =
        "normal";

      item.style.overflowWrap =
        "normal";


      item.style.transform =
        `translate(-50%, -50%) scale(${textObject.scale})`;


      if (
        selectedTextId ===
        textObject.id
      ) {

        item.classList.add(
          "is-selected"
        );
      }


      const content =
        document.createElement(
          "span"
        );

      content.className =
        "card-text-content";

      content.textContent =
        textObject.text ||
        "텍스트 입력";


      /*
        ★ content 자체에도 동일하게 적용
      */
      content.style.whiteSpace =
        "pre";

      content.style.wordBreak =
        "normal";

      content.style.overflowWrap =
        "normal";

      content.style.textAlign =
        textObject.align;

      content.style.display =
        "inline-block";


      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.type =
        "button";

      deleteButton.className =
        "card-text-delete";

      deleteButton.textContent =
        "×";

      deleteButton.setAttribute(
        "aria-label",
        "텍스트 삭제"
      );


      item.appendChild(
        content
      );

      item.appendChild(
        deleteButton
      );

      textLayer.appendChild(
        item
      );


      setupTextElement(
        item,
        content,
        deleteButton,
        textObject
      );
    }
  );


  /*
    현재 선택 텍스트 기준으로
    정렬 버튼 상태 갱신
  */
  updateTextAlignButtons();
}

// =====================================================
// TEXT SELECT
// =====================================================

function selectText(id) {

  selectedTextId =
    id === null
      ? null
      : Number(id);

  textLayer
    ?.querySelectorAll(
      ".card-text-item"
    )
    .forEach((item) => {

      item.classList.toggle(
        "is-selected",
        Number(
          item.dataset.textId
        ) === selectedTextId
      );
    });


  /*
    ★ 선택된 텍스트의 정렬값을
    버튼 UI에도 반영
  */
  updateTextAlignButtons();
}

// =====================================================
// TEXT ALIGN
// =====================================================

let textAlignButtons =
  document.querySelectorAll(
    ".text-align-btn"
  );


/*
  HTML에 정렬 버튼이 아직 없다면
  JS가 자동으로 생성.

  따라서 기존 HTML을 또 수정할 필요 없음.
*/
function createTextAlignTools() {

  if (!addCardTextBtn) {
    return;
  }


  const existing =
    document.querySelector(
      ".text-align-tools"
    );

  if (existing) {

    textAlignButtons =
      document.querySelectorAll(
        ".text-align-btn"
      );

    return;
  }


  const tools =
    document.createElement(
      "div"
    );

  tools.className =
    "text-align-tools";


  /*
    현재 CSS에 클래스가 없어도
    기본적으로 보이도록 최소 스타일 적용
  */
  tools.style.display =
    "flex";

  tools.style.gap =
    "8px";

  tools.style.marginTop =
    "8px";


  const alignData = [

    {
      value: "left",
      label: "왼쪽 정렬",
      icon: "☰"
    },

    {
      value: "center",
      label: "가운데 정렬",
      icon: "☰"
    },

    {
      value: "right",
      label: "오른쪽 정렬",
      icon: "☰"
    }
  ];


  alignData.forEach(
    (data) => {

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "text-align-btn";

      button.dataset.align =
        data.value;

      button.setAttribute(
        "aria-label",
        data.label
      );


      /*
        텍스트 아이콘
      */
      button.innerHTML =
        `<span>${data.icon}</span>`;


      button.style.flex =
        "1";

      button.style.height =
        "42px";

      button.style.border =
        "1px solid rgba(255,255,255,.25)";

      button.style.borderRadius =
        "10px";

      button.style.background =
        "#222";

      button.style.color =
        "#aaa";

      button.style.fontSize =
        "18px";


      /*
        ☰ 모양을 이용해
        정렬 방향 표현
      */
      const span =
        button.querySelector(
          "span"
        );

      if (span) {

        span.style.display =
          "block";

        span.style.width =
          "24px";

        span.style.margin =
          "0 auto";

        span.style.textAlign =
          data.value;
      }


      tools.appendChild(
        button
      );
    }
  );


  addCardTextBtn.insertAdjacentElement(
    "afterend",
    tools
  );


  textAlignButtons =
    document.querySelectorAll(
      ".text-align-btn"
    );


  bindTextAlignButtons();

  updateTextAlignButtons();
}


/*
  정렬 버튼 선택 표시
*/
function updateTextAlignButtons() {

  const object =
    selectedTextId !== null
      ? getTextObject(
          selectedTextId
        )
      : null;


  const currentAlign =
    object?.align ||
    "center";


  textAlignButtons.forEach(
    (button) => {

      const active =
        button.dataset.align ===
        currentAlign;


      button.classList.toggle(
        "active",
        active
      );


      button.style.background =
        active
          ? "#ffffff"
          : "#222222";

      button.style.color =
        active
          ? "#111111"
          : "#aaaaaa";
    }
  );
}


/*
  버튼 이벤트
*/
function bindTextAlignButtons() {

  textAlignButtons.forEach(
    (button) => {

      /*
        중복 이벤트 방지
      */
      if (
        button.dataset.bound ===
        "true"
      ) {
        return;
      }

      button.dataset.bound =
        "true";


      button.addEventListener(
        "click",
        () => {

          if (
            selectedTextId === null
          ) {
            return;
          }


          finishTextEditing();


          const object =
            getTextObject(
              selectedTextId
            );


          if (!object) {
            return;
          }


          const newAlign =
            button.dataset.align;


          if (!newAlign) {
            return;
          }


          if (
            object.align ===
            newAlign
          ) {

            updateTextAlignButtons();

            return;
          }


          object.align =
            newAlign;


          renderTexts();

          selectText(
            object.id
          );


          /*
            ★ 정렬 변경도
            직전 행동 1회로 Undo 가능
          */
          saveHistory();
        }
      );
    }
  );
}


/*
  기존 HTML에 버튼이 있는 경우도 대응
*/
bindTextAlignButtons();


/*
  없으면 자동 생성
*/
createTextAlignTools();

function deselectText() {

  finishTextEditing();

  selectedTextId = null;

  textLayer
    ?.querySelectorAll(
      ".card-text-item"
    )
    .forEach((item) => {

      item.classList.remove(
        "is-selected"
      );
    });
}


// =====================================================
// TEXT EDIT
// =====================================================

function startTextEditing(
  id,
  selectAll = false
) {

  const object =
    getTextObject(id);

  const item =
    getTextElement(id);

  const content =
    item?.querySelector(
      ".card-text-content"
    );

  if (
    !object ||
    !item ||
    !content
  ) {
    return;
  }

  selectText(id);

  /*
    placeholder를 실제 텍스트로 만들지 않음.
  */
  if (!object.text) {
    content.textContent = "";
  }

  content.setAttribute(
    "contenteditable",
    "true"
  );

  content.setAttribute(
    "spellcheck",
    "false"
  );

  item.classList.add(
    "is-editing"
  );

  content.focus();


  if (selectAll) {

    requestAnimationFrame(
      () => {

        try {

          const selection =
            window.getSelection();

          const range =
            document.createRange();

          range.selectNodeContents(
            content
          );

          selection.removeAllRanges();
          selection.addRange(range);

        } catch (error) {
          // ignore
        }
      }
    );
  }
}


function finishTextEditing() {

  const editingContent =
    textLayer?.querySelector(
      '.card-text-content[contenteditable="true"]'
    );

  if (!editingContent) {
    return;
  }

  const item =
    editingContent.closest(
      ".card-text-item"
    );

  if (!item) {
    return;
  }

  const id =
    Number(
      item.dataset.textId
    );

  const object =
    getTextObject(id);

  if (!object) {
    return;
  }

  const newText =
    editingContent.innerText
      .replace(/\r/g, "")
      .trim();


  const changed =
    object.text !== newText;

  object.text =
    newText;


  editingContent.setAttribute(
    "contenteditable",
    "false"
  );

  item.classList.remove(
    "is-editing"
  );


  if (!object.text) {

    editingContent.textContent =
      "텍스트 입력";

  } else {

    editingContent.textContent =
      object.text;
  }


  if (
    changed &&
    !restoringHistory
  ) {

    saveHistory();
  }
}


// =====================================================
// TEXT INTERACTION
// =====================================================

function setupTextElement(
  item,
  content,
  deleteButton,
  textObject
) {

  /*
    pointerId -> 좌표
  */
  const pointers =
    new Map();

  let startX = 0;
  let startY = 0;

  let startObjectX = 0;
  let startObjectY = 0;

  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  let gestureChanged = false;

  /*
    pointerup 뒤 click 이벤트가 발생하는 걸 막기 위한 값
  */
  let suppressClick = false;


  item.addEventListener(
    "pointerdown",
    (event) => {

      if (
        event.target ===
        deleteButton
      ) {
        return;
      }


      /*
        텍스트 직접 편집 중이면
        caret 조작을 허용.
      */
      if (
        content.getAttribute(
          "contenteditable"
        ) === "true"
      ) {
        return;
      }


      event.stopPropagation();

      selectText(
        textObject.id
      );


      pointers.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY
        }
      );


      try {

        item.setPointerCapture(
          event.pointerId
        );

      } catch (error) {
        // ignore
      }


      /*
        첫 손가락
      */
      if (
        pointers.size === 1
      ) {

        startX =
          event.clientX;

        startY =
          event.clientY;

        startObjectX =
          textObject.x;

        startObjectY =
          textObject.y;

        gestureChanged = false;
        suppressClick = false;
      }


      /*
        두 손가락 → PINCH
      */
      if (
        pointers.size === 2
      ) {

        const points =
          [...pointers.values()];

        pinchStartDistance =
          getDistance(
            points[0],
            points[1]
          );

        pinchStartScale =
          textObject.scale;

        gestureChanged = true;
        suppressClick = true;

        event.preventDefault();
      }
    }
  );


  item.addEventListener(
    "pointermove",
    (event) => {

      if (
        !pointers.has(
          event.pointerId
        )
      ) {
        return;
      }


      pointers.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY
        }
      );


      /*
        PINCH SCALE
      */
      if (
        pointers.size >= 2
      ) {

        event.preventDefault();

        const points =
          [...pointers.values()];

        const distance =
          getDistance(
            points[0],
            points[1]
          );


        if (
          pinchStartDistance >
          0
        ) {

          const ratio =
            distance /
            pinchStartDistance;

          textObject.scale =
            clamp(
              pinchStartScale *
                ratio,
              0.4,
              4
            );


          item.style.transform =
            `translate(-50%, -50%) scale(${textObject.scale})`;

          gestureChanged = true;
          suppressClick = true;
        }

        return;
      }


      /*
        DRAG
      */
      if (
        pointers.size === 1
      ) {

        const dx =
          event.clientX -
          startX;

        const dy =
          event.clientY -
          startY;


        /*
          몇 px 정도는 일반 탭으로 취급.
        */
        if (
          Math.abs(dx) < 5 &&
          Math.abs(dy) < 5 &&
          !gestureChanged
        ) {
          return;
        }


        event.preventDefault();

        const rect =
          cardStage.getBoundingClientRect();

        if (
          !rect.width ||
          !rect.height
        ) {
          return;
        }


        textObject.x =
          clamp(
            startObjectX +
              (
                dx /
                rect.width
              ) *
              100,
            0,
            100
          );


        textObject.y =
          clamp(
            startObjectY +
              (
                dy /
                rect.height
              ) *
              100,
            0,
            100
          );


        item.style.left =
          `${textObject.x}%`;

        item.style.top =
          `${textObject.y}%`;


        gestureChanged = true;
        suppressClick = true;
      }
    }
  );


  function endPointer(event) {

    if (
      !pointers.has(
        event.pointerId
      )
    ) {
      return;
    }


    pointers.delete(
      event.pointerId
    );


    try {

      item.releasePointerCapture(
        event.pointerId
      );

    } catch (error) {
      // ignore
    }


    /*
      모든 손가락이 떨어졌을 때
      이동/확대 전체를 행동 1회로 기록.
    */
    if (
      pointers.size === 0 &&
      gestureChanged
    ) {

      saveHistory();

      /*
        pointerup 직후 발생하는 click이
        텍스트 편집을 켜지 못하게 한 프레임 늦게 해제.
      */
      setTimeout(
        () => {

          suppressClick = false;

        },
        80
      );

      gestureChanged = false;
    }
  }


  item.addEventListener(
    "pointerup",
    endPointer
  );

  item.addEventListener(
    "pointercancel",
    endPointer
  );


  /*
    일반 탭 → 편집
  */
  item.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();


      if (
        event.target ===
        deleteButton
      ) {
        return;
      }


      if (suppressClick) {
        return;
      }


      startTextEditing(
        textObject.id,
        false
      );
    }
  );


  /*
    편집 완료
  */
  content.addEventListener(
    "blur",
    () => {

      /*
        삭제 버튼 누르면서 blur 될 수 있으므로
        함수에서 안전하게 처리.
      */
      finishTextEditing();
    }
  );




  /*
    삭제 버튼
  */
  deleteButton.addEventListener(
    "pointerdown",
    (event) => {

      event.preventDefault();
      event.stopPropagation();
    }
  );


  deleteButton.addEventListener(
    "click",
    (event) => {

      event.preventDefault();
      event.stopPropagation();

      const index =
        textObjects.findIndex(
          (object) =>
            object.id ===
            textObject.id
        );


      if (index === -1) {
        return;
      }


      textObjects.splice(
        index,
        1
      );


      if (
        selectedTextId ===
        textObject.id
      ) {

        selectedTextId = null;
      }


      renderTexts();

      saveHistory();
    }
  );
}


// =====================================================
// 빈 곳 터치
// =====================================================

cardStage?.addEventListener(
  "pointerdown",
  (event) => {

    // 텍스트 자체를 누른 경우
    if (
      event.target.closest?.(
        ".card-text-item"
      )
    ) {
      return;
    }

    // ★ 텍스트가 선택되어 있었다면
    // 이번 터치는 선택 해제만 하고 그림은 그리지 않음
    if (selectedTextId !== null) {

      event.preventDefault();
      event.stopPropagation();

      finishTextEditing();
      selectText(null);

      return;
    }
  },
  true
);

// =====================================================
// HISTORY
// =====================================================

function getHistoryState() {

  return {

    strokes:
      cloneData(
        strokes
      ),

    texts:
      cloneData(
        textObjects
      ),

    nextTextId:
      nextTextId
  };
}


function historyStateKey(state) {

  return JSON.stringify(
    state
  );
}


function saveHistory(
  force = false
) {

  if (restoringHistory) {
    return;
  }


  const state =
    getHistoryState();

  const key =
    historyStateKey(
      state
    );

  const last =
    cardHistory[
      cardHistory.length - 1
    ];


  if (
    !force &&
    last &&
    last.key === key
  ) {
    return;
  }


  cardHistory.push({
    state,
    key
  });


  /*
    이미지 dataURL이 아니라
    벡터 데이터라 50단계까지 보관.
  */
  if (
    cardHistory.length >
    50
  ) {

    cardHistory.shift();
  }
}


// =====================================================
// HISTORY RESTORE
// =====================================================

function restoreHistoryState(
  state
) {

  if (!state) return;

  restoringHistory = true;

  finishTextEditing();

  strokes =
    cloneData(
      state.strokes || []
    );

  textObjects =
    cloneData(
      state.texts || []
    );

  nextTextId =
    state.nextTextId || 1;

  selectedTextId = null;

  renderDrawing();
  renderTexts();

  restoringHistory = false;
}


// =====================================================
// UNDO
// =====================================================

undoDrawingBtn?.addEventListener(
  "click",
  () => {

    finishTextEditing();


    if (
      cardHistory.length <= 1
    ) {
      return;
    }


    /*
      현재 행동 제거
    */
    cardHistory.pop();


    /*
      직전 상태 복원
    */
    const previous =
      cardHistory[
        cardHistory.length - 1
      ];


    restoreHistoryState(
      previous.state
    );
  }
);


// =====================================================
// RESET
// =====================================================

resetDrawingBtn?.addEventListener(
  "click",
  () => {

    finishTextEditing();

    /*
      이미 비어있으면 아무것도 안 함.
    */
    if (
      strokes.length === 0 &&
      textObjects.length === 0
    ) {
      return;
    }


    strokes = [];
    textObjects = [];

    selectedTextId = null;

    renderDrawing();
    renderTexts();

    /*
      처음부터 역시 행동 1회.
      실행취소하면 초기화 전으로 복구.
    */
    saveHistory();
  }
);


// =====================================================
// EXPORT HELPERS
// =====================================================

function getExportFontSize(
  textObject
) {

  const stageRect =
    cardStage.getBoundingClientRect();

  if (!stageRect.width) {
    return 60;
  }


  /*
    CSS 기본 26px 기준.
    실제 canvas 해상도로 환산.
  */
  const baseCssFontSize =
    window.innerWidth <= 480
      ? 22
      : 26;


  const scaleToCanvas =
    drawingCanvas.width /
    stageRect.width;


  return (
    baseCssFontSize *
    scaleToCanvas *
    textObject.scale
  );
}


function drawMultilineText(
  context,
  textObject
) {

  if (
    !textObject.text ||
    !textObject.text.trim()
  ) {
    return;
  }


  const centerX =
    (
      textObject.x /
      100
    ) *
    drawingCanvas.width;


  const centerY =
    (
      textObject.y /
      100
    ) *
    drawingCanvas.height;


  const fontSize =
    getExportFontSize(
      textObject
    );


  /*
    ★ 자동 줄바꿈 절대 없음.
    사용자가 직접 Enter한 것만 줄 분리.
  */
  const lines =
    textObject.text
      .replace(/\r/g, "")
      .split("\n");


  const lineHeight =
    fontSize * 1.25;


  context.save();


  context.font =
    `800 ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;


  context.fillStyle =
    textObject.color;


  context.textBaseline =
    "middle";


  const align =
    textObject.align ||
    "center";


  /*
    각 줄 중 가장 긴 폭 계산.
    좌/우 정렬 시 전체 텍스트 박스 기준점을 맞춤.
  */
  const maxWidth =
    Math.max(
      1,
      ...lines.map(
        (line) => {

          return context
            .measureText(
              line || " "
            )
            .width;
        }
      )
    );


  let drawX =
    centerX;


  if (
    align === "left"
  ) {

    drawX =
      centerX -
      maxWidth / 2;

  } else if (
    align === "right"
  ) {

    drawX =
      centerX +
      maxWidth / 2;
  }


  context.textAlign =
    align;


  const startY =
    centerY -
    (
      (
        lines.length - 1
      ) *
      lineHeight
    ) /
    2;


  lines.forEach(
    (line, index) => {

      context.fillText(
        line,
        drawX,
        startY +
          index *
          lineHeight
      );
    }
  );


  context.restore();
}

// =====================================================
// FINAL EXPORT
// =====================================================

completeCardBtn?.addEventListener(
  "click",
  async () => {

    if (
      !selectedCardUrl ||
      !drawingCanvas ||
      !drawingCtx
    ) {
      return;
    }


    finishTextEditing();
    selectText(null);


    try {

      completeCardBtn.disabled =
        true;

      completeCardBtn.textContent =
        "이미지 만드는 중...";


      const baseImage =
        await loadImage(
          selectedCardUrl
        );


      const finalCanvas =
        document.createElement(
          "canvas"
        );


      finalCanvas.width =
        drawingCanvas.width;

      finalCanvas.height =
        drawingCanvas.height;


      const finalCtx =
        finalCanvas.getContext(
          "2d"
        );


      /*
        1. 원본
      */
      finalCtx.drawImage(
        baseImage,
        0,
        0,
        finalCanvas.width,
        finalCanvas.height
      );


      /*
        2. 낙서
      */
      finalCtx.drawImage(
        drawingCanvas,
        0,
        0,
        finalCanvas.width,
        finalCanvas.height
      );


      /*
        3. 텍스트
      */
      textObjects.forEach(
        (textObject) => {

          drawMultilineText(
            finalCtx,
            textObject
          );
        }
      );


      const blob =
        await new Promise(
          (resolve) => {

            finalCanvas.toBlob(
              resolve,
              "image/png",
              1
            );
          }
        );


      if (!blob) {

        throw new Error(
          "PNG 생성 실패"
        );
      }


      completedCardBlob =
        blob;


      if (
        completedCardBlobUrl
      ) {

        URL.revokeObjectURL(
          completedCardBlobUrl
        );
      }


      completedCardBlobUrl =
        URL.createObjectURL(
          blob
        );


      completedCardPreview.src =
        completedCardBlobUrl;


      closeCardModal(
        cardEditorModal
      );


      openCardModal(
        cardCompleteModal
      );


    } catch (error) {

      console.error(
        "카드 완성 오류:",
        error
      );


      alert(
        "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
      );


    } finally {

      completeCardBtn.disabled =
        false;

      completeCardBtn.textContent =
        "축하카드 완성하기";
    }
  }
);


// =====================================================
// COPY
// =====================================================

async function copyTextFallback(
  text
) {

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value =
    text;

  textarea.style.position =
    "fixed";

  textarea.style.opacity =
    "0";

  textarea.style.pointerEvents =
    "none";

  document.body.appendChild(
    textarea
  );

  textarea.focus();
  textarea.select();

  let success = false;

  try {

    success =
      document.execCommand(
        "copy"
      );

  } catch (error) {

    success = false;
  }

  textarea.remove();

  return success;
}


copyShareTextBtn?.addEventListener(
  "click",
  async () => {

    const text =
      shareCopyText
        ?.innerText
        .trim();

    if (!text) {
      return;
    }


    let success = false;


    try {

      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {

        await navigator.clipboard.writeText(
          text
        );

        success = true;

      } else {

        success =
          await copyTextFallback(
            text
          );
      }

    } catch (error) {

      success =
        await copyTextFallback(
          text
        );
    }


    if (!success) {

      alert(
        "복사에 실패했습니다. 문구를 직접 선택해 복사해주세요."
      );

      return;
    }


    const original =
      copyShareTextBtn.textContent;


    copyShareTextBtn.textContent =
      "✓ 복사완료!";


    setTimeout(
      () => {

        copyShareTextBtn.textContent =
          original;

      },
      1600
    );
  }
);


// =====================================================
// SAVE IMAGE → MOBILE SHARE SHEET
// =====================================================

// =====================================================
// SAVE IMAGE → SHARE SHEET
// =====================================================

// =====================================================
// SAVE IMAGE
// iOS          → 공유시트
// Android      → 공유시트
// Android InApp → JPG 다운로드
// =====================================================

saveCardBtn?.addEventListener(
  "click",
  async () => {

    if (!completedCardBlob) {
      alert("저장할 이미지가 없습니다.");
      return;
    }

    try {

      const userAgent =
        navigator.userAgent || "";

      const isAndroid =
        /Android/i.test(userAgent);

      // 카카오 / 인스타 / 페이스북 / 네이버 등
      // 대표적인 Android 인앱 브라우저 감지
      const isInAppBrowser =
        /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line|DaumApps/i.test(
          userAgent
        );


      // =================================================
      // Android + 인앱 브라우저
      // → 공유시트 사용하지 않고 JPG 다운로드
      // =================================================

      if (
        isAndroid &&
        isInAppBrowser
      ) {

        const image =
          new Image();

        image.src =
          URL.createObjectURL(
            completedCardBlob
          );

        await new Promise(
          (resolve, reject) => {

            image.onload =
              resolve;

            image.onerror =
              reject;

          }
        );


        const jpgCanvas =
          document.createElement(
            "canvas"
          );

        jpgCanvas.width =
          image.naturalWidth;

        jpgCanvas.height =
          image.naturalHeight;


        const jpgCtx =
          jpgCanvas.getContext(
            "2d"
          );


        // JPG는 투명 배경이 없으므로
        // 흰색 배경 생성
        jpgCtx.fillStyle =
          "#ffffff";

        jpgCtx.fillRect(
          0,
          0,
          jpgCanvas.width,
          jpgCanvas.height
        );


        jpgCtx.drawImage(
          image,
          0,
          0
        );


        const jpgBlob =
          await new Promise(
            (resolve) => {

              jpgCanvas.toBlob(
                resolve,
                "image/jpeg",
                0.95
              );

            }
          );


        if (!jpgBlob) {
          throw new Error(
            "JPG 생성 실패"
          );
        }


        const jpgUrl =
          URL.createObjectURL(
            jpgBlob
          );


        const link =
          document.createElement(
            "a"
          );

        link.href =
          jpgUrl;

        link.download =
          "EPIKHIGH_23rd_Anniversary_Card.jpg";


        document.body.appendChild(
          link
        );

        link.click();

        link.remove();


        setTimeout(
          () => {

            URL.revokeObjectURL(
              jpgUrl
            );

          },
          1500
        );


        return;
      }


      // =================================================
      // iPhone / Android 일반 브라우저
      // → 기존 PNG 공유시트 그대로
      // =================================================

      const file =
        new File(
          [completedCardBlob],
          "EPIKHIGH_23rd_Anniversary_Card.png",
          {
            type: "image/png"
          }
        );


      if (
        typeof navigator.share ===
          "function" &&

        (
          typeof navigator.canShare !==
            "function" ||

          navigator.canShare({
            files: [file]
          })
        )
      ) {

        await navigator.share({
          files: [file],
          title:
            "EPIK HIGH 23rd Anniversary"
        });

        return;
      }


      // =================================================
      // 기타 미지원 브라우저
      // → PNG 다운로드 fallback
      // =================================================

      const downloadUrl =
        URL.createObjectURL(
          completedCardBlob
        );


      const link =
        document.createElement(
          "a"
        );

      link.href =
        downloadUrl;

      link.download =
        "EPIKHIGH_23rd_Anniversary_Card.png";


      document.body.appendChild(
        link
      );

      link.click();

      link.remove();


      setTimeout(
        () => {

          URL.revokeObjectURL(
            downloadUrl
          );

        },
        1500
      );


    } catch (error) {

      // 공유시트를 사용자가 직접 닫은 경우
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }


      console.error(
        "이미지 저장 오류:",
        error
      );


      alert(
        "이미지를 저장하지 못했습니다."
      );

    }

  }
);

// =====================================================
// ESC
// =====================================================

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !== "Escape"
    ) {
      return;
    }


    /*
      텍스트 편집 중이면
      먼저 편집만 종료.
    */
    const editing =
      textLayer?.querySelector(
        '.card-text-content[contenteditable="true"]'
      );


    if (editing) {

      finishTextEditing();

      return;
    }


    if (
      cardCompleteModal?.classList.contains(
        "is-open"
      )
    ) {

      closeCardModal(
        cardCompleteModal
      );

      return;
    }


    if (
      cardEditorModal?.classList.contains(
        "is-open"
      )
    ) {

      deselectText();

      closeCardModal(
        cardEditorModal
      );

      return;
    }


    if (
      cardSelectModal?.classList.contains(
        "is-open"
      )
    ) {

      closeCardModal(
        cardSelectModal
      );
    }
  }
);


// =====================================================
// 완료 팝업 → 에디터로 돌아갈 때를 대비한 정리
// =====================================================

window.addEventListener(
  "beforeunload",
  () => {

    if (
      completedCardBlobUrl
    ) {

      URL.revokeObjectURL(
        completedCardBlobUrl
      );
    }
  }
);
