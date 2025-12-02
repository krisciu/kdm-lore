# Kingdom Death: Monster Lore Compendium

![KDM Lore](https://img.shields.io/badge/Kingdom%20Death-Lore%20Wiki-orange)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

The ultimate wiki and lore compendium for Kingdom Death: Monster. Explore the dark mysteries of monsters, locations, survivors, philosophies, and the cosmic horrors that lurk beyond the lantern's light.

## ✨ Features

### 📚 Lore Compendium
- **Comprehensive Database**: Detailed entries for monsters, locations, survivors, items, events, philosophies, and entities
- **Rich Content**: Full lore descriptions, quotes, connections, and source citations
- **Advanced Search**: Filter and search across all lore entries
- **Category Organization**: Browse by monster types, locations, philosophies, and more

### 🧠 AI Research Lab
- **Interactive Research**: Ask questions about KDM lore and get detailed responses
- **Lore Discovery**: AI-powered exploration of connections and hidden details
- **Entry Proposals**: Suggest new lore entries with AI assistance
- **Continuous Updates**: The compendium grows through community and AI collaboration

### 📜 Timeline
- **Historical Overview**: Explore the eras of Kingdom Death from the primordial void to the current age
- **Event Connections**: See how events connect to lore entries
- **Visual Journey**: Follow humanity's struggle through time

### 🎨 Atmospheric Design
- **Dark Theme**: Immersive design inspired by the game's aesthetic
- **Lantern Glow**: Warm accent colors reminiscent of the lantern's light
- **Gothic Typography**: Cinzel and Cormorant Garamond fonts
- **Smooth Animations**: Framer Motion powered interactions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/kdm-lore.git
cd kdm-lore
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up environment variables for AI features:
```bash
cp .env.example .env.local
# Edit .env.local and add your OpenAI API key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
kdm-lore/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   ├── lore/           # Lore pages
│   │   ├── research/       # Research Lab
│   │   ├── timeline/       # Timeline page
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Homepage
│   ├── components/         # React components
│   ├── data/              # Lore data and seed content
│   └── types/             # TypeScript types
├── public/                # Static assets
└── ...config files
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI**: [OpenAI GPT-4](https://openai.com/) (optional)

## 📖 Adding Lore

### Manual Entry
Edit `src/data/lore.ts` to add new entries:

```typescript
{
  id: 'unique-id',
  slug: 'url-friendly-slug',
  title: 'Entry Title',
  category: 'monster', // monster, location, survivor, etc.
  summary: 'Brief description...',
  content: 'Full markdown content...',
  tags: ['tag1', 'tag2'],
  sources: [
    { name: 'Core Rulebook', type: 'rulebook', verified: true }
  ],
  confidence: 'confirmed', // confirmed, likely, speculative
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}
```

### AI-Assisted
Use the Research Lab to propose new entries:
1. Navigate to the Research Lab
2. Ask about a topic or describe new lore
3. Review the AI-generated entry
4. Approve to add to the compendium

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Add Lore**: Submit pull requests with new lore entries
2. **Fix Errors**: Report or fix inaccuracies in existing lore
3. **Improve Design**: Enhance the UI/UX
4. **Add Features**: Propose and implement new features

## ⚠️ Disclaimer

This is a fan-made resource. Kingdom Death: Monster is © Adam Poots Games, LLC. This project is not affiliated with or endorsed by Adam Poots Games.

All lore content is sourced from official Kingdom Death: Monster materials and community interpretations. We strive for accuracy but some content may be speculative.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*"In the darkness, there is no history. There is only survival, and the stories we tell to make sense of the void."*
