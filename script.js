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

async function initPage() {

  // 글자수 초기화
  if (
    guestInput &&
    charCount
  ) {

    charCount.textContent =
      `${guestInput.value.length} / 100`;

  }


  // canvas 준비
  resizeCanvas();


  // ★ Supabase 저장 데이터 로드
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