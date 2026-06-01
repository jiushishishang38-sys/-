import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  BarChart3,
  Brain,
  FlaskConical,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Microscope,
  ScanEye,
  Sun,
  Target,
  UserRound,
  Zap,
} from 'lucide-react';

gsap.registerPlugin(useGSAP);

const guideCards = [
  { icon: Lightbulb, title: '理解原理', text: '掌握眼睛的结构与光学成像原理', tone: 'violet' },
  { icon: ScanEye, title: '观察现象', text: '观察屈光现象，建立直观的视觉认知', tone: 'blue' },
  { icon: FlaskConical, title: '模拟实验', text: '通过模拟实验探索屈光的变化规律', tone: 'green' },
  { icon: BarChart3, title: '应用拓展', text: '将知识应用于近视、远视等问题分析', tone: 'amber' },
];

const goals = [
  { no: '01', title: '认知目标', text: '了解人眼的基本结构及各部分的功能', icon: Brain },
  { no: '02', title: '理解目标', text: '理解光线在眼内的折射过程及成像原理', icon: Microscope },
  { no: '03', title: '分析目标', text: '能够分析常见屈光不正的成因', icon: ScanEye },
  { no: '04', title: '应用目标', text: '学会运用所学知识解决实际问题', icon: Target },
];

const processNodes = [
  { title: '光线进入', text: '光线从外界进入眼睛', icon: Sun },
  { title: '屈光系统', text: '角膜、晶状体等产生折射', icon: ScanEye },
  { title: '眼内成像', text: '物像在视网膜上形成', icon: ImageIcon },
  { title: '神经传导', text: '视神经传递信号', icon: Zap },
  { title: '大脑感知', text: '大脑处理形成视觉', icon: Brain },
];

const labels = [
  { title: '角膜', text: '光线进入眼睛的第一道折射界面', top: '24%', left: '70%' },
  { title: '晶状体', text: '调节焦距，使物像清晰', top: '40%', left: '70%' },
  { title: '视网膜', text: '感光成像，形成视觉信号', top: '56%', left: '70%' },
  { title: '视神经', text: '将视觉信号传递至大脑', top: '72%', left: '70%' },
];

function GuideApp() {
  const containerRef = useRef(null);

  useGSAP((context, contextSafe) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      gsap.set('.guide-motion, .guide-title > *, .guide-card, .goal-card, .lower-panel, .eye-label, .process-node, .guide-ray', {
        clearProps: 'all',
        opacity: 1,
      });
      return;
    }

    gsap.set('.guide-title > *, .guide-card, .goal-card, .lower-panel, .eye-label, .process-node, .guide-tip', {
      willChange: 'transform, opacity',
    });

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    timeline
      .from('.guide-title > *', { y: 28, duration: 0.58, stagger: 0.08 })
      .from('.guide-card', { y: 26, scale: 0.96, duration: 0.46, stagger: 0.07 }, '-=0.24')
      .from('.eye-stage', { x: 34, scale: 0.97, duration: 0.68 }, '-=0.5')
      .from('.eye-label', { x: 24, scale: 0.96, duration: 0.38, stagger: 0.08 }, '-=0.22')
      .from('.goal-card', { y: 18, scale: 0.98, duration: 0.38, stagger: 0.06 }, '-=0.14')
      .from('.lower-panel', { y: 22, duration: 0.48, stagger: 0.08 }, '-=0.08')
      .from('.guide-tip', { y: 12, duration: 0.36 }, '-=0.18');

    gsap.fromTo(
      '.guide-ray',
      { scaleX: 0, opacity: 0.15, transformOrigin: 'left center' },
      { scaleX: 1, opacity: 0.92, duration: 1.55, stagger: 0.1, ease: 'sine.inOut', repeat: -1, repeatDelay: 0.62 },
    );

    gsap.to('.eye-image', {
      y: -8,
      duration: 3.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    gsap.to('.eye-label span', {
      scale: 1.16,
      opacity: 0.72,
      duration: 1.25,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.12,
    });

    gsap.to('.process-node', {
      y: -5,
      duration: 1.8,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.14,
    });

    const interactiveItems = gsap.utils.toArray('.guide-card, .goal-card, .process-node');
    const enterItem = contextSafe((event) => {
      gsap.to(event.currentTarget, {
        y: -6,
        scale: 1.015,
        duration: 0.24,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
    const leaveItem = contextSafe((event) => {
      gsap.to(event.currentTarget, {
        y: 0,
        scale: 1,
        duration: 0.28,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });

    interactiveItems.forEach((item) => {
      item.addEventListener('pointerenter', enterItem);
      item.addEventListener('pointerleave', leaveItem);
      item.addEventListener('focus', enterItem);
      item.addEventListener('blur', leaveItem);
    });

    return () => {
      interactiveItems.forEach((item) => {
        item.removeEventListener('pointerenter', enterItem);
        item.removeEventListener('pointerleave', leaveItem);
        item.removeEventListener('focus', enterItem);
        item.removeEventListener('blur', leaveItem);
      });
    };
  }, { scope: containerRef });

  return (
    <main className="guide-page-v2" ref={containerRef}>
      <section className="guide-hero-v2" aria-labelledby="guide-heading">
        <div className="guide-intro">
          <div className="guide-title">
            <h1 id="guide-heading">探索视觉的奥秘</h1>
            <p>从光线进入眼睛到形成清晰的图像，了解视觉形成的基本过程</p>
            <span aria-hidden="true" />
          </div>

          <div className="guide-card-grid" aria-label="学习路径">
            {guideCards.map(({ icon: Icon, title, text, tone }) => (
              <article className={`guide-card guide-motion tone-${tone}`} key={title}>
                <div className="guide-card-icon">
                  <Icon size={36} strokeWidth={2.1} />
                </div>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="eye-stage guide-motion" aria-label="人眼结构示意图">
          <div className="ray-field" aria-hidden="true">
            <span className="guide-ray ray-main" />
            <span className="guide-ray ray-upper" />
            <span className="guide-ray ray-lower" />
          </div>
          <img className="eye-image" src="./eye.png" alt="人眼剖面结构" />
          <div className="dot-grid" aria-hidden="true" />
          {labels.map((label, index) => (
            <div className={`eye-label eye-label-${index + 1}`} style={{ top: label.top, left: label.left }} key={label.title}>
              <span aria-hidden="true" />
              <strong>{label.title}</strong>
              <small>{label.text}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="learning-strip guide-motion" aria-labelledby="goals-heading">
        <h2 id="goals-heading">学习目标</h2>
        <div className="goal-grid">
          {goals.map(({ no, title, text, icon: Icon }) => (
            <article className="goal-card" key={no}>
              <span>{no}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <Icon className="goal-watermark" size={70} strokeWidth={1.7} aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="guide-lower">
        <article className="lower-panel process-panel" aria-labelledby="process-heading">
          <h2 id="process-heading">知识导图</h2>
          <div className="process-flow">
            <div className="process-start">视觉形成<br />的过程</div>
            {processNodes.map(({ title, text, icon: Icon }) => (
              <div className="process-node" key={title}>
                <div>
                  <Icon size={30} strokeWidth={2} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="lower-panel thinking-panel" aria-labelledby="thinking-heading">
          <h2 id="thinking-heading">课前思考</h2>
          <div className="thinking-content">
            <HelpCircle className="thinking-icon" size={44} strokeWidth={2.2} aria-hidden="true" />
            <ul>
              <li>为什么我们能看到物体？光线在眼中如何传播？</li>
              <li>近视和远视是如何产生的？如何矫正？</li>
              <li>如果眼球的某个部分发生变化，会对视觉产生什么影响？</li>
            </ul>
            <UserRound className="thinking-person" size={118} strokeWidth={1.6} aria-hidden="true" />
          </div>
        </article>
      </section>

      <p className="guide-tip guide-motion">
        <span>i</span>
        <strong>小提示：</strong>
        带着这些问题进入学习，能帮助你更好地理解知识点，在后续实验中获得更深刻的体验！
      </p>
    </main>
  );
}

createRoot(document.getElementById('guide-root')).render(<GuideApp />);
