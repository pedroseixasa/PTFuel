# PT FUEL - Otimizações Implementadas

## ✅ O que foi feito:

### 1. **Google Analytics 4**

- ✅ Script adicionado ao `<head>`
- ⚠️ **IMPORTANTE**: Substitua `G-XXXXXXXXXX` pelo seu ID do GA4
- Como obter:
  1. Acesse https://analytics.google.com
  2. Crie uma nova propriedade
  3. Copie o ID (começa com "G-")
  4. Cole em dois locais no `index.html`

### 2. **Ads.txt**

- ✅ Arquivo `ads.txt` criado na raiz
- Contém: `google.com, pub-1601336674013871, DIRECT, f08c47fec0942fa0`
- Valide em: https://www.google.com/adsense/

### 3. **SEO Otimizado**

- ✅ Meta tags adicionadas
- ✅ DNS Prefetch para melhor performance
- ✅ Schema.org JSON-LD estruturado
- ✅ Open Graph para redes sociais

### 4. **Responsividade Melhorada**

- ✅ Breakpoints para tablet (768px) e mobile (480px)
- ✅ Flexbox layout responsivo
- ✅ SVG map otimizado
- ✅ Tipografia escalável

### 5. **Performance**

- ✅ DNS Prefetch ativado
- ✅ Box-sizing global
- ✅ Lazy loading ready
- ✅ Estilos para animações otimizadas
- ✅ Print styles

### 6. **Acessibilidade**

- ✅ Respeita preferência `prefers-reduced-motion`

---

## 📋 TODO - Próximos Passos:

1. **Configurar Google Analytics:**
   - [ ] Ir a https://analytics.google.com
   - [ ] Copiar ID (G-...)
   - [ ] Colar no `index.html` (2 locais)

2. **Testar Responsividade:**
   - [ ] DevTools > F12 > Toggle device toolbar
   - [ ] Testar em 480px, 768px, 1200px

3. **Validar SEO:**
   - [ ] PageSpeed: https://pagespeed.web.dev
   - [ ] Schema Validator: https://schema.org/validate

4. **Deploy:**
   - [ ] Fazer upload para servidor
   - [ ] Verificar ads.txt em `ptfuel.pt/ads.txt`

5. **Monitorização:**
   - [ ] Analytics > Verificar tráfego
   - [ ] AdSense > Monitorar cliques

---

## 🔧 Como implementar Lazy Loading em imagens:

```html
<img src="imagem.jpg" loading="lazy" alt="Descrição" />
```

---

## 📊 Arquivos modificados:

- ✅ `index.html` - Analytics + SEO + AdSense
- ✅ `css/app.css` - Responsividade + Performance
- ✅ `ads.txt` - Novacriado

---

**Precisa de ajuda com algo específico?**
