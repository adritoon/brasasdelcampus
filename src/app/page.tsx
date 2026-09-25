'use client';

import { useEffect, useState } from 'react';
import {
  Flame,
  MapPin,
  Clock,
  Phone,
  ChevronRight,
  UtensilsCrossed,
  ExternalLink,
} from 'lucide-react';
import { subscribeToMenu } from '@/lib/firestore';
import type { MenuItem } from '@/lib/types';
import { CATEGORIAS } from '@/lib/types';
import styles from './page.module.css';

export default function PublicPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Parrilla');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Registrar service worker para PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const unsub = subscribeToMenu((items) => {
      setMenu(items.filter((i) => i.disponible));
      setLoading(false);
    });
    return unsub;
  }, []);

  const menuFiltrado = menu.filter((item) => item.categoria === categoriaActiva);

  return (
    <div className={`${styles.page} texture-bg`}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo}>
            <Flame size={22} strokeWidth={2.5} />
            <span>Brasas del Campus</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#carta">Carta</a>
            <a href="#nosotros">Nosotros</a>
            <a href="#contacto">Contacto</a>
          </div>
        </div>
      </nav>

      {/* Intro */}
      <header className={styles.intro}>
        <div className={styles.introContent}>
          <p className={styles.tagline}>Pollería y Parrillas</p>
          <h1>El gustito parrillero<br />que buscabas.</h1>
          <p className={styles.introDesc}>
            El verdadero pollo a la brasa, jugoso y con papas bien crocantes. 
            Anticuchos de corazón, cortes a la parrilla bien servidos y las cremas 
            de la casa para comer rico y sin complicaciones.
          </p>
          <div className={styles.introCta}>
            <a href="#carta" className="btn btn-primary btn-lg">
              Ver la carta
              <ChevronRight size={18} />
            </a>
            <div className={styles.introMeta}>
              <Clock size={15} />
              <span>Lun–Sáb: 12:00 – 22:00</span>
            </div>
          </div>
        </div>
      </header>

      {/* Carta */}
      <section id="carta" className={styles.menuSection}>
        <div className="container">
          <div className={styles.menuHeader}>
            <h2>Nuestra carta</h2>
            <p>Precios en soles (S/). Todos los platos se preparan al momento.</p>
          </div>

          {/* Tabs de categoría */}
          <div className="tabs">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                className={`tab ${categoriaActiva === cat ? 'active' : ''}`}
                onClick={() => setCategoriaActiva(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Items */}
          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : (
            <div className={styles.menuGrid}>
              {menuFiltrado.length === 0 ? (
                <div className="empty-state">
                  <UtensilsCrossed size={40} />
                  <p>No hay platos en esta categoría por ahora.</p>
                </div>
              ) : (
                menuFiltrado.map((item) => (
                  <article key={item.id} className={styles.menuItem}>
                    <div className={styles.menuItemBody}>
                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion}</p>
                    </div>
                    <div className={styles.menuItemPrice}>
                      S/ {item.precio.toFixed(2)}
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" className={styles.about}>
        <div className="container container-narrow">
          <h2>El lugar</h2>
          <div className={styles.aboutGrid}>
            <div className={styles.aboutText}>
              <p>
                [Colocar aquí la historia del restaurante]
              </p>
            </div>
            <div className={styles.aboutDetails}>
              <div className={styles.detailItem}>
                <Clock size={18} />
                <div>
                  <strong>Horario</strong>
                  <span>Lun – Sáb: 12:00 – 22:00</span>
                  <span>Domingos cerrado</span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <MapPin size={18} />
                <div>
                  <strong>Ubicación</strong>
                  <span>Jr. Los Pinos 342, cerca del campus</span>
                  <span>A 2 cuadras de la puerta principal</span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <Phone size={18} />
                <div>
                  <strong>Contacto</strong>
                  <span>WhatsApp: 987 654 321</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacto" className={styles.footer}>
        <div className="container">
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <Flame size={18} />
              <span>Brasas del Campus</span>
            </div>
            <p className={styles.footerCopy}>
              Hecho con fuego y ganas. Todos los derechos reservados.
            </p>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerSocial}
            >
              <ExternalLink size={18} />
              @brasasdelcampus
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
