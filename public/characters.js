// Maya and Rosa: original characters, drawn as layered SVG with named groups
// (ids work as layer names if the SVG is imported into Rive or Figma).
// Animated with CSS only (see styles.css, .chr-*): blink, breathe, phone glow,
// Rosa reading. `state` changes Maya's face: "worried" or "relieved".

export function maya(state = "determined", { size = 180, title = "Maya, an ICU nurse, standing tall with her phone raised" } = {}) {
  // A hero pose: feet planted, hand on hip, phone held up like the receipt it is.
  // "determined" before she checks; "proud" once PayPal's record backs her up.
  const proud = state === "proud" || state === "relieved";
  const browL = "M80 59 Q88 55 95 60";
  const browR = "M105 60 Q112 55 120 59";
  const mouth = proud ? "M90 82 Q100 90 111 81" : "M91 84 Q101 86 110 81";
  return `<svg class="chr chr-maya ${proud ? "is-proud" : "is-determined"}" viewBox="0 0 200 300" width="${size}" height="${Math.round(size * 1.5)}" role="img" aria-label="${title}">
  <defs>
    <radialGradient id="maya-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#bff0d8" stop-opacity=".55"/><stop offset="1" stop-color="#bff0d8" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse id="maya-shadow" cx="102" cy="286" rx="58" ry="7" fill="#000" opacity=".25"/>
  <g id="maya" class="chr-breathe">
    <g id="maya-coat-back"><path d="M126 108 C160 140 172 200 166 248 L144 238 C146 200 140 160 122 124 Z" fill="#17233a"/></g>
    <g id="maya-legs">
      <path d="M80 174 L66 276 L88 279 L100 182 Z" fill="#27606d"/>
      <path d="M102 182 L116 279 L138 276 L124 174 Z" fill="#27606d"/>
      <path d="M58 274 Q58 286 72 288 L92 288 Q96 280 88 274 Z" fill="#f3efe6"/>
      <path d="M114 274 Q108 282 112 288 L134 288 Q148 286 146 274 Z" fill="#f3efe6"/>
    </g>
    <g id="maya-torso">
      <path d="M70 108 Q100 98 130 108 L136 180 Q100 190 64 180 Z" fill="#2f6f7e"/>
      <path d="M92 103 L100 122 L108 103 Z" fill="#245866"/>
      <path d="M82 112 L90 158" stroke="#e9d9b8" stroke-width="2" fill="none"/>
      <rect x="84" y="155" width="13" height="10" rx="2" fill="#fbf7ef"/>
    </g>
    <g id="maya-coat-front">
      <path d="M70 108 L60 214 L80 218 L86 122 Z" fill="#1d2c47"/>
      <path d="M130 108 L150 214 L126 216 L116 122 Z" fill="#1d2c47"/>
    </g>
    <g id="maya-arm-hip">
      <path d="M70 110 L56 134 L70 141 L80 118 Z" fill="#2f6f7e"/>
      <path d="M57 136 L48 152 Q50 160 60 160 L78 170 L83 162 L66 151 L70 141 Z" fill="#8d5b3e"/>
      <circle cx="81" cy="166" r="6" fill="#8d5b3e"/>
    </g>
    <g id="maya-neck"><rect x="92" y="88" width="16" height="20" rx="6" fill="#7c4f33"/></g>
    <g id="maya-head" class="chr-tilt">
      <circle id="maya-bun" cx="100" cy="26" r="16" fill="#1c1311"/>
      <ellipse cx="74" cy="68" rx="4.5" ry="7" fill="#87573a"/>
      <ellipse cx="126" cy="68" rx="4.5" ry="7" fill="#87573a"/>
      <circle cx="74" cy="74" r="1.8" fill="#e8c46a"/>
      <circle cx="126" cy="74" r="1.8" fill="#e8c46a"/>
      <ellipse id="maya-face" cx="100" cy="66" rx="26" ry="30" fill="#8d5b3e"/>
      <path id="maya-hair" d="M73 66 C70 38 86 36 100 36 C114 36 130 38 127 66 C124 52 114 45 100 45 C86 45 76 52 73 66 Z" fill="#1c1311"/>
      <path id="maya-brow-l" d="${browL}" stroke="#1c1311" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path id="maya-brow-r" d="${browR}" stroke="#1c1311" stroke-width="3" stroke-linecap="round" fill="none"/>
      <g id="maya-eyes" class="chr-blink">
        <ellipse cx="88" cy="66" rx="3.8" ry="4.2" fill="#1b1110"/>
        <ellipse cx="112" cy="66" rx="3.8" ry="4.2" fill="#1b1110"/>
        <circle cx="89.3" cy="64.6" r="1.2" fill="#fff"/>
        <circle cx="113.3" cy="64.6" r="1.2" fill="#fff"/>
      </g>
      <path id="maya-nose" d="M100 69 Q97 76 101 78" stroke="#6a4129" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path id="maya-mouth" d="${mouth}" stroke="#4e2419" stroke-width="2.8" stroke-linecap="round" fill="none"/>
    </g>
    <ellipse id="maya-phone-light" class="chr-glow" cx="158" cy="76" rx="34" ry="34" fill="url(#maya-glow)"/>
    <g id="maya-arm-phone">
      <path d="M130 108 L146 122 L138 131 L122 118 Z" fill="#2f6f7e"/>
      <path d="M137 130 L147 123 L162 100 L152 93 Z" fill="#8d5b3e"/>
      <g id="maya-phone" transform="rotate(8 158 76)">
        <rect x="143" y="50" width="30" height="50" rx="5" fill="#0b1220"/>
        <rect x="146" y="55" width="24" height="40" rx="3" fill="#fbf7ef"/>
        <rect x="149" y="59" width="18" height="5" rx="1.5" fill="#b23a2e"/>
        <path class="chr-check" d="M151 74 L156 79 L165 69" stroke="#157a55" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="149" y="85" width="18" height="6" rx="2" fill="#ffc439"/>
      </g>
      <circle cx="156" cy="94" r="7" fill="#8d5b3e"/>
    </g>
  </g>
</svg>`;
}

export function rosa({ size = 220, verdict = false, title = "Rosa, a PayPal dispute reviewer, weighing the evidence at her desk" } = {}) {
  // The judge: neutral and appraising. She doesn't cheer; she checks line 1, then nods once.
  return `<svg class="chr chr-rosa" viewBox="0 0 240 200" width="${size}" height="${Math.round(size * 0.833)}" role="img" aria-label="${title}">
  <g id="rosa" class="chr-breathe">
    <g id="rosa-body">
      <path d="M96 200 C98 160 122 142 156 142 C190 142 214 160 216 200 Z" fill="#2f5aa8"/>
      <path d="M142 143 L156 168 L170 143 Z" fill="#fbf7ef"/>
      <g id="rosa-badge">
        <circle cx="190" cy="160" r="9" fill="#fbf7ef"/>
        <path d="M190 154 L190 166 M184 156 L196 156 M184 156 L181.5 161 L186.5 161 Z M196 156 L193.5 161 L198.5 161 Z M187 166 L193 166" stroke="#17233a" stroke-width="1.3" fill="none" stroke-linejoin="round"/>
      </g>
    </g>
    <g id="rosa-neck"><rect x="145" y="118" width="22" height="30" rx="9" fill="#b98157"/></g>
    <g id="rosa-head" class="chr-nod">
      <path id="rosa-hair-back" d="M118 96 C116 52 136 40 156 40 C178 40 198 54 194 98 C196 122 192 140 182 146 L130 146 C120 138 116 120 118 96 Z" fill="#2b1a12"/>
      <ellipse id="rosa-face" cx="156" cy="94" rx="30" ry="36" fill="#c28c63"/>
      <path id="rosa-hair-front" d="M124 94 C120 58 144 48 162 52 C182 56 192 70 190 92 C184 78 172 70 160 70 C150 76 136 80 124 94 Z" fill="#2b1a12"/>
      <path id="rosa-brow-l" d="M134 81 Q142 79 150 80" stroke="#2b1a12" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path id="rosa-brow-r" d="M162 80 Q170 79 178 81" stroke="#2b1a12" stroke-width="3" stroke-linecap="round" fill="none"/>
      <g id="rosa-eyes" class="chr-blink chr-read">
        <ellipse cx="142" cy="94" rx="4.2" ry="4.8" fill="#24150f"/>
        <ellipse cx="170" cy="94" rx="4.2" ry="4.8" fill="#24150f"/>
        <circle cx="143.4" cy="92.6" r="1.2" fill="#fff"/>
        <circle cx="171.4" cy="92.6" r="1.2" fill="#fff"/>
      </g>
      <g id="rosa-glasses" fill="none" stroke="#3a2a22" stroke-width="2.4">
        <rect x="131" y="85" width="22" height="17" rx="6"/>
        <rect x="159" y="85" width="22" height="17" rx="6"/>
        <path d="M153 92 L159 92"/>
      </g>
      <path id="rosa-nose" d="M156 98 Q153 107 157 109" stroke="#9a6644" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path id="rosa-mouth" d="${verdict ? "M147 116 Q156 120 165 116" : "M148 117 Q156 118 164 117"}" stroke="#6b2f24" stroke-width="2.8" stroke-linecap="round" fill="none"/>
      <circle cx="126" cy="104" r="2.2" fill="#e8c46a"/>
    </g>
  </g>
  <g id="rosa-desk">
    <rect x="0" y="176" width="240" height="24" fill="#d9cfbd"/>
    <g id="rosa-monitor">
      <rect x="10" y="78" width="104" height="80" rx="7" fill="#17233a"/>
      <rect x="16" y="84" width="92" height="64" rx="3" fill="#fbf7ef"/>
      <rect class="chr-line1" x="20" y="90" width="84" height="12" rx="2" fill="#e3f3ec"/>
      <rect x="23" y="94" width="54" height="4" rx="2" fill="#157a55"/>
      <path class="chr-check" d="M86 96 L90 100 L98 91" stroke="#157a55" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="23" y="108" width="70" height="4" rx="2" fill="#c9c2b4"/>
      <rect x="23" y="117" width="62" height="4" rx="2" fill="#c9c2b4"/>
      <rect x="23" y="126" width="74" height="4" rx="2" fill="#c9c2b4"/>
      <rect x="23" y="135" width="48" height="4" rx="2" fill="#c9c2b4"/>
      <rect x="54" y="158" width="16" height="18" fill="#17233a"/>
    </g>
  </g>
  <g id="rosa-arm-point" class="chr-point">
    <path d="M128 150 L104 130 L113 121 L136 142 Z" fill="#2f5aa8"/>
    <path d="M104 131 L101 108 L110 106 L113 121 Z" fill="#c28c63"/>
    <circle cx="105" cy="104" r="6.5" fill="#c28c63"/>
    <rect x="94" y="99" width="11" height="4.5" rx="2.2" fill="#c28c63"/>
  </g>
</svg>`;
}
