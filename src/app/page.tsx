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
import { subscribeToMenu, subscribeToCategories } from '@/lib/firestore';
import type { MenuItem } from '@/lib/types';
import styles from './page.module.css';

export default function PublicPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Parrilla');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubCat = subscribeToCategories((cats) => {
      setCategorias(cats);
      if (cats.length > 0 && !cats.includes(categoriaActiva)) {
        setCategoriaActiva(cats[0]);
      }
    });
    return unsubCat;
  }, [categoriaActiva]);

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
          <p className={`${styles.tagline} animate-fade-in-up`}>Pollería y Parrillas</p>
          <h1 className="animate-fade-in-up delay-100">El gustito parrillero<br />que buscabas.</h1>
          <p className={`${styles.introDesc} animate-fade-in-up delay-200`}>
            El verdadero pollo a la brasa, jugoso y con papas bien crocantes. 
            Anticuchos de corazón, cortes a la parrilla bien servidos y las cremas 
            de la casa para comer rico y sin complicaciones.
          </p>
          <div className={`${styles.introCta} animate-fade-in-up delay-300`}>
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
            {categorias.map((cat) => (
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
                <div className="animate-fade-in">
                  {menuFiltrado.map((item, idx) => (
                    <article
                      key={item.id}
                      className={styles.menuItem}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1 }}>
                        {item.imagen && (
                          <img src={item.imagen} alt={item.nombre} className={styles.menuItemImage} />
                        )}
                        <div className={styles.menuItemBody}>
                          <h3>{item.nombre}</h3>
                          <p>{item.descripcion}</p>
                        </div>
                      </div>
                      <div className={styles.menuItemPrice}>
                        S/ {item.precio.toFixed(2)}
                      </div>
                    </article>
                  ))}
                </div>
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
                Nuestra historia comenzó con una pasión: hacer que cada bocado tenga sabor a hogar y a fuego. Somos más que una pollería, somos el punto de encuentro de amigos, familias y estudiantes que buscan una comida contundente después de un día largo.
              </p>
              <p>
                Asamos nuestros pollos con leña seleccionada y preparamos cortes a la parrilla en su punto exacto, manteniendo esa tradición artesanal que nos caracteriza desde el primer día.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacto" className={styles.footer}>
        <div className="container">
          <div className={styles.footerGrid}>
            <div className={styles.detailItem}>
              <Flame size={20} />
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--cream-50)', marginBottom: '8px', display: 'block' }}>Brasas del Campus</strong>
                <p style={{ color: 'var(--smoke-400)', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: '250px' }}>
                  El verdadero pollo a la brasa y cortes parrilleros. Sabor artesanal, como en casa.
                </p>
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
              <Clock size={18} />
              <div>
                <strong>Horario</strong>
                <span>Lun – Sáb: 12:00 – 22:00</span>
                <span>Domingos cerrado</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <Phone size={18} />
              <div>
                <strong>Contacto</strong>
                <span>WhatsApp: 987 654 321</span>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.footerSocial}
                  style={{ marginTop: '12px' }}
                >
                  <ExternalLink size={16} />
                  @brasasdelcampus
                </a>
              </div>
            </div>
          </div>
          
          <div className={styles.footerCopy}>
            &copy; {new Date().getFullYear()} Brasas del Campus. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
