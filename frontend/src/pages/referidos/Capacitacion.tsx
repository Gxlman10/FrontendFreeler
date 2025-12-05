import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lightbulb, MessageCircle, Send, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IaService } from '@/services/ia.service';
import { useToast } from '@/components/common/Toasts';

type Message = {
  author: 'user' | 'assistant';
  text: string;
};

const initialMessages: Message[] = [
  {
    author: 'assistant',
    text: 'Hola, soy Freeler Coach. Preguntame como atraer referidos de calidad, vender campanas y que datos compartir para cerrar ventas. ',
  },
];

const QUICK_TOPICS = [
  {
    id: 'guion',
    question: 'Que guion recomiendas para mi primera llamada con un lead nuevo y no sonar improvisado?',
  },
  {
    id: 'info',
    question: 'Que datos deberia pedirle a un lead para que el vendedor pueda cerrar la venta mas rapido?',
  },
  {
    id: 'seguimiento',
    question: 'Comparte un plan de seguimiento de 3 pasos para no perder el interes del lead.',
  },
  {
    id: 'objeciones',
    question: 'Como respondo cuando el lead duda del precio o no confia en la campana?',
  },
];

export const Capacitacion = () => {
  const { push } = useToast();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (payload: { message: string; history: { role: 'user' | 'assistant'; content: string }[] }) =>
      IaService.chat(payload),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { author: 'assistant', text: data.reply }]);
    },
    onError: () => {
      push({
        title: 'No pude conectarme con la IA',
        description: 'Intenta nuevamente en unos instantes.',
        variant: 'danger',
      });
      setMessages((prev) => [
        ...prev,
        {
          author: 'assistant',
          text: 'Hubo un problema al generar la respuesta. Vuelve a intentarlo.',
        },
      ]);
    },
  });

  useEffect(() => {
    if (!chatBodyRef.current) return;
    chatBodyRef.current.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, mutation.isPending]);

  const enforceTopic = (text: string) => {
    const normalized = text.toLowerCase();
    const keywords = ['lead', 'referid', 'camp', 'venta', 'cliente', 'comision', 'seguimiento', 'llamada'];
    const isOnTopic = keywords.some((keyword) => normalized.includes(keyword));
    if (isOnTopic) return text;
    return `${text}\n\nRecordatorio: responde redirigiendo la conversacion a consejos para captar referidos, vender campanas o mejorar el proceso comercial.`;
  };

  const sendMessage = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    setMessages((prev) => {
      const next = [...prev, { author: 'user', text: trimmed }];
      const historyPayload = next.slice(-6).map((message) => ({
        role: message.author,
        content: message.text,
      }));
      mutation.mutate({
        message: enforceTopic(trimmed),
        history: historyPayload,
      });
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    const question = input.trim();
    setInput('');
    sendMessage(question);
  };

  const isTyping = mutation.isPending;
  const handleQuickPrompt = (question: string) => {
    sendMessage(question);
  };

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="rounded-3xl bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-400 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Sparkles className="h-4 w-4" />
              Freeler Coach
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Capacitacion Freeler</h1>
            <p className="text-sm text-white/80">
              Aprende a captar referidos de calidad, gestionar objeciones y compartir la informacion que necesita tu
              vendedor para cerrar ventas.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-border bg-surface/80 p-5 shadow-lg dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-sm font-semibold text-content">
            <MessageCircle className="h-4 w-4 text-primary-500" />
            Conversacion
          </div>
          <div
            ref={chatBodyRef}
            className="flex h-[38rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-surface-muted/80 px-4 py-4 pr-6 shadow-inner dark:bg-slate-900/60"
          >
            {messages.map((message, index) => (
              <div key={`${message.author}-${index}`} className="flex flex-col gap-1">
                <span
                  className={`text-xs font-semibold ${
                    message.author === 'assistant' ? 'text-indigo-500 dark:text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  {message.author === 'assistant' ? 'Freeler Coach' : 'Tu'}
                </span>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-md ring-1 ${
                    message.author === 'assistant'
                      ? 'self-start border border-indigo-100 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50'
                      : 'self-end border border-primary-700/70 bg-primary-600 text-white dark:border-primary-400 dark:bg-primary-500'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 self-start rounded-3xl bg-gradient-to-r from-indigo-500/10 to-indigo-500/20 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-200">
                Freeler Coach esta escribiendo...
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-dashed border-border px-3 py-3 text-xs text-content-muted dark:border-slate-700">
            <p className="mb-2 font-semibold text-content">Preguntas rapidas</p>
            <div className="flex flex-col gap-2">
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-content transition hover:border-primary-400 hover:text-primary-600 dark:bg-slate-900/70"
                  onClick={() => handleQuickPrompt(topic.question)}
                >
                  {topic.question}
                </button>
              ))}
            </div>
          </div>
          <form className="flex items-center gap-3" onSubmit={handleSubmit}>
            <Input
              className="flex-1"
              placeholder="Escribe tu pregunta enfocada en referidos, campanas o ventas..."
              value={input}
              disabled={mutation.isPending}
              onChange={(event) => setInput(event.target.value)}
            />
            <Button type="submit" disabled={mutation.isPending} variant="primary" className="min-w-[140px]">
              {mutation.isPending ? (
                'Enviando...'
              ) : (
                <>
                  Enviar
                  <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-dashed border-border p-5 text-sm text-content-muted dark:border-slate-700">
            <p className="font-semibold text-content">En caso de dudas:</p>
            <p className="mt-2">
              Freeler Coach esta optimizado solo para temas comerciales. Si escribes sobre otro topico, reconducira la
              conversacion a estrategias de captacion o ventas.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default Capacitacion;
