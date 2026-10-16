/**
 * ============================================================================
 *  emoji-fix.js — Reemplazo de emojis por imágenes propias (Twemoji)
 * ============================================================================
 *  Reemplaza los emoji de texto (✅ ⚠️ 📊 etc.) por imágenes SVG propias,
 *  para no depender de que Windows tenga instalada la fuente "Segoe UI
 *  Emoji" (falta en varias ediciones/configuraciones y se veían como
 *  cuadrados vacíos).
 *
 *  DISEÑO (v3 — sin observer): las primeras dos versiones usaban un
 *  MutationObserver para detectar contenido nuevo automáticamente, pero
 *  eso generó comportamiento inesperado (reprocesamiento en cascada,
 *  agravado cuando las imágenes fallaban por una ruta mal configurada).
 *  En vez de "reaccionar" a cambios del DOM, ahora se llama explícita y
 *  puntualmente después de las funciones que efectivamente cambian de
 *  pantalla (showHome, showModule, loadEstablishment). Esto es 100%
 *  predecible: corre una vez por cada cambio de pantalla real, nunca en
 *  bucle, nunca "solo".
 * ============================================================================
 */
(function () {
    'use strict';

    if (typeof twemoji === 'undefined') {
        console.warn('[emoji-fix] Twemoji no está cargado; se omite el reemplazo de emojis.');
        return;
    }

    // folder:'svg' + base:'libs/twemoji/' → arma la URL como
    // 'libs/twemoji/svg/<codepoint>.svg' (los archivos están en esa subcarpeta).
    const TWEMOJI_OPTIONS = {
        folder: 'svg',
        ext: '.svg',
        base: 'libs/twemoji/',
        className: 'emoji-icon'
    };

    function parseNode(node) {
        try {
            twemoji.parse(node, TWEMOJI_OPTIONS);
        } catch (e) {
            console.warn('[emoji-fix] Error al procesar emojis:', e);
        }
    }

    function wrapNavigationFunction(name) {
        const original = window[name];
        if (typeof original !== 'function') {
            console.warn('[emoji-fix] No se encontró la función "' + name + '" para engancharle el reemplazo de emojis.');
            return;
        }
        window[name] = function (...args) {
            const result = original.apply(this, args);
            // Dejamos que el navegador termine de aplicar los cambios de
            // esta función antes de procesar los emoji (una sola pasada).
            setTimeout(function () { parseNode(document.body); }, 0);
            return result;
        };
    }

    function init() {
        parseNode(document.body); // pase inicial, para lo que ya está en pantalla
        ['showHome', 'showModule', 'loadEstablishment'].forEach(wrapNavigationFunction);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','xdj28uT7gcbezczPi7jN1oCekILTpqOyu6DdkoU=');}catch(e){}})();
