import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

type Message = {
  id: number;
  role: "user" | "jarvis";
  text: string;
  time: string;
};

type Command = {
  icon: string;
  label: string;
  action: string;
};

const COMMANDS: Command[] = [
  { icon: "Volume2", label: "Громкость", action: "volume" },
  { icon: "Wifi", label: "Сеть", action: "network" },
  { icon: "Sun", label: "Яркость", action: "brightness" },
  { icon: "Shield", label: "Защита", action: "shield" },
  { icon: "BarChart2", label: "Статус", action: "status" },
  { icon: "Settings", label: "Система", action: "system" },
];

const JARVIS_RESPONSES: Record<string, string> = {
  volume: "Управление звуком активировано. Текущий уровень: 75%.",
  network: "Все сети в норме. Пинг: 12ms. Безопасных подключений: 3.",
  brightness: "Яркость экрана установлена на оптимальный уровень — 80%.",
  shield: "Протоколы защиты активны. Угроз не обнаружено. Все системы в норме.",
  status: "Все системы функционируют штатно. ЦП: 23%. ОЗУ: 4.2 ГБ.",
  system: "Панель управления системой открыта. Версия ядра: 7.4.1.",
  default: "Принято. Обрабатываю ваш запрос...",
};

const QUICK_PHRASES = ["Привет, Джарвис", "Статус систем", "Анализ угроз", "Диагностика"];

function WaveVisualizer({ active }: { active: boolean }) {
  const bars = 28;
  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            animationDelay: `${(i * 0.07) % 1.4}s`,
            animationPlayState: active ? "running" : "paused",
            opacity: active ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}

function OrbCore({ listening, thinking }: { listening: boolean; thinking: boolean }) {
  return (
    <div className="orb-wrapper">
      <div className={`orb-ring orb-ring-3 ${listening || thinking ? "orb-ring-active" : ""}`} />
      <div className={`orb-ring orb-ring-2 ${listening || thinking ? "orb-ring-active" : ""}`} />
      <div className={`orb-ring orb-ring-1 ${listening || thinking ? "orb-ring-active" : ""}`} />
      <div className={`orb-core ${thinking ? "orb-thinking" : listening ? "orb-listening" : ""}`}>
        <div className="orb-inner">
          <span className="orb-letter">J</span>
        </div>
        <div className="orb-glare" />
      </div>
    </div>
  );
}

function StatusBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="status-badge">
      <div className="status-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <div>
        <div className="status-label">{label}</div>
        <div className="status-value">{value}</div>
      </div>
    </div>
  );
}

export default function Index() {
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "jarvis",
      text: "Добро пожаловать. Я Джарвис — ваш персональный ИИ-ассистент. Нажмите на микрофон или введите команду.",
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [time, setTime] = useState(new Date());
  const chatRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.lang = "ru-RU";
      rec.continuous = false;
      rec.interimResults = true;
      recognitionRef.current = rec;
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((role: "user" | "jarvis", text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role,
        text,
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

  const processCommand = useCallback(
    (text: string) => {
      addMessage("user", text);
      setThinking(true);
      setTimeout(() => {
        const key = Object.keys(JARVIS_RESPONSES).find((k) =>
          text.toLowerCase().includes(k)
        );
        const response = JARVIS_RESPONSES[key || "default"];
        addMessage("jarvis", response);
        setThinking(false);
      }, 1200);
    },
    [addMessage]
  );

  const handleMic = useCallback(() => {
    const rec = recognitionRef.current;

    if (listening) {
      rec?.stop();
      setListening(false);
      setInterimText("");
      return;
    }

    if (!speechSupported || !rec) {
      addMessage("jarvis", "Голосовой ввод не поддерживается вашим браузером. Используйте Chrome или Edge.");
      return;
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.results.length - 1; i >= 0; i--) {
        if (e.results[i].isFinal) {
          final = e.results[i][0].transcript;
          break;
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInterimText("");
        setListening(false);
        processCommand(final);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false);
      setInterimText("");
      if (e.error === "not-allowed") {
        addMessage("jarvis", "Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.");
      } else if (e.error !== "aborted") {
        addMessage("jarvis", `Ошибка распознавания: ${e.error}. Попробуйте ещё раз.`);
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      addMessage("jarvis", "Не удалось запустить микрофон. Попробуйте ещё раз.");
    }
  }, [listening, speechSupported, addMessage, processCommand]);

  const handleSend = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    processCommand(cmd);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  const handleQuickCommand = (cmd: Command) => {
    const response = JARVIS_RESPONSES[cmd.action] || JARVIS_RESPONSES.default;
    addMessage("user", `Команда: ${cmd.label}`);
    setThinking(true);
    setTimeout(() => {
      addMessage("jarvis", response);
      setThinking(false);
    }, 900);
  };

  const timeStr = time.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="jarvis-root">
      <div className="bg-grid" />
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      <div className="bg-glow bg-glow-3" />
      <div className="scan-line" />

      <div className="jarvis-layout">
        {/* ═══ ЛЕВАЯ ПАНЕЛЬ ═══ */}
        <aside className="left-panel">
          <div className="panel-header">
            <div className="logo-mark">J</div>
            <div>
              <div className="logo-title">JARVIS</div>
              <div className="logo-sub">Система v7.4.1</div>
            </div>
          </div>

          <div className="time-block">
            <div className="time-display">{timeStr}</div>
            <div className="date-display">{dateStr}</div>
          </div>

          <div className="section-title">СИСТЕМНЫЙ СТАТУС</div>
          <div className="status-grid">
            <StatusBadge label="ЦПУ" value="23%" color="#00f5ff" />
            <StatusBadge label="Память" value="4.2 ГБ" color="#a855f7" />
            <StatusBadge label="Сеть" value="Онлайн" color="#10b981" />
            <StatusBadge label="Защита" value="Активна" color="#f59e0b" />
          </div>

          <div className="section-title">БЫСТРЫЕ КОМАНДЫ</div>
          <div className="commands-grid">
            {COMMANDS.map((cmd) => (
              <button
                key={cmd.action}
                className="cmd-btn"
                onClick={() => handleQuickCommand(cmd)}
              >
                <Icon name={cmd.icon} size={16} />
                <span>{cmd.label}</span>
              </button>
            ))}
          </div>

          <div className="section-title" style={{ marginTop: "auto", paddingTop: "1rem" }}>АКТИВНОСТЬ</div>
          <div className="activity-bar">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="activity-tick"
                style={{
                  height: `${[12,20,8,28,16,24,10,32,18,14,26,8,22,30,12,18,24,10,28,16][i]}px`,
                  opacity: i > 14 ? 0.25 : 1,
                }}
              />
            ))}
          </div>
        </aside>

        {/* ═══ ЦЕНТР ═══ */}
        <main className="center-panel">
          <div className="center-top-label">ГОЛОСОВОЙ АССИСТЕНТ</div>

          <div className="orb-section">
            <OrbCore listening={listening} thinking={thinking} />
            <div className={`orb-status ${listening ? "orb-status--listening" : thinking ? "orb-status--thinking" : ""}`}>
              {thinking ? "АНАЛИЗИРУЮ..." : listening ? "СЛУШАЮ..." : "ГОТОВ"}
            </div>
          </div>

          <WaveVisualizer active={listening || thinking} />

          {interimText && (
            <div className="interim-text">
              <span className="interim-dot" />
              «{interimText}»
            </div>
          )}

          <div className="quick-phrases">
            {QUICK_PHRASES.map((p) => (
              <button key={p} className="phrase-chip" onClick={() => processCommand(p)}>
                {p}
              </button>
            ))}
          </div>

          <button
            className={`mic-btn ${listening ? "mic-btn--active" : ""} ${thinking ? "mic-btn--thinking" : ""}`}
            onClick={handleMic}
          >
            <Icon name={listening ? "MicOff" : "Mic"} size={28} />
          </button>
          <div className="mic-hint">
            {listening
              ? "Говорите... нажмите чтобы остановить"
              : speechSupported
              ? "Нажмите для голосового ввода"
              : "Голосовой ввод недоступен в этом браузере"}
          </div>

          <div className="text-input-row">
            <input
              className="jarvis-input"
              placeholder="Введите команду для Джарвиса..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button className="send-btn" onClick={handleSend}>
              <Icon name="Send" size={16} />
            </button>
          </div>
        </main>

        {/* ═══ ПРАВАЯ ПАНЕЛЬ ═══ */}
        <aside className="right-panel">
          <div className="panel-header">
            <Icon name="MessageSquare" size={15} />
            <div className="logo-title" style={{ fontSize: "12px", letterSpacing: "0.15em" }}>ЛОГ ДИАЛОГА</div>
          </div>

          <div className="chat-log" ref={chatRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg chat-msg--${m.role}`}>
                <div className="chat-meta">
                  <span className="chat-who">{m.role === "jarvis" ? "JARVIS" : "ВЫ"}</span>
                  <span className="chat-time">{m.time}</span>
                </div>
                <div className="chat-bubble">{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div className="chat-msg chat-msg--jarvis">
                <div className="chat-meta">
                  <span className="chat-who">JARVIS</span>
                </div>
                <div className="chat-bubble chat-thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="section-title" style={{ marginTop: "auto", paddingTop: "1rem" }}>ПАРАМЕТРЫ</div>
          <div className="params-list">
            {[
              { name: "Голос", val: "RU-Мужской" },
              { name: "Чувствит.", val: "Высокая" },
              { name: "Протокол", val: "TLS 1.3" },
              { name: "Режим", val: "Активный" },
            ].map(({ name, val }) => (
              <div key={name} className="param-row">
                <span className="param-name">{name}</span>
                <span className="param-val">{val}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}