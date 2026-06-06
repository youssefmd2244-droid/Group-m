// Global type shims — fixes JSX and module resolution when @types/* are not yet installed
declare module 'react' {
  // Re-export minimal React types needed for TSC
  export const useState: any;
  export const useEffect: any;
  export const useRef: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useContext: any;
  export const useReducer: any;
  export const createContext: any;
  export const forwardRef: any;
  export const memo: any;
  export const Fragment: any;
  export const Component: any;
  export const PureComponent: any;
  export const Children: any;
  export const cloneElement: any;
  export const createElement: any;
  export const isValidElement: any;
  export const StrictMode: any;
  export const Suspense: any;
  export const lazy: any;
  export const startTransition: any;
  export default React;
  const React: any;
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
declare module 'react-dom' {
  export const render: any;
  export const createRoot: any;
  const ReactDOM: any;
  export default ReactDOM;
}
declare module 'react-dom/client' {
  export const createRoot: any;
  export const hydrateRoot: any;
}
declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
declare module 'lucide-react' {
  const _: any;
  export = _;
  export const Archive: any;
  export const Loader2: any;
  export const WifiOff: any;
  export const CheckCircle: any;
  export const XCircle: any;
  export const Settings: any;
  export const User: any;
  export const Download: any;
  export const Upload: any;
  export const Trash2: any;
  export const Edit: any;
  export const Plus: any;
  export const X: any;
  export const Check: any;
  export const Search: any;
  export const Phone: any;
  export const Mail: any;
  export const Lock: any;
  export const Unlock: any;
  export const Eye: any;
  export const EyeOff: any;
  export const RefreshCw: any;
  export const AlertCircle: any;
  export const Info: any;
  export const ChevronDown: any;
  export const ChevronUp: any;
  export const ChevronRight: any;
  export const ChevronLeft: any;
  export const Menu: any;
  export const Home: any;
  export const FileText: any;
  export const Image: any;
  export const Video: any;
  export const Camera: any;
  export const Star: any;
  export const Heart: any;
  export const Share2: any;
  export const Copy: any;
  export const ExternalLink: any;
  export const Globe: any;
  export const Database: any;
  export const Shield: any;
  export const LogOut: any;
  export const Save: any;
  export const Wifi: any;
  export const WifiOff: any;
  export const Zap: any;
  export const Clock: any;
  export const Calendar: any;
  export const MapPin: any;
  export const Filter: any;
  export const SortAsc: any;
  export const SortDesc: any;
  export const BarChart: any;
  export const BarChart2: any;
  export const PieChart: any;
  export const TrendingUp: any;
  export const Users: any;
  export const UserPlus: any;
  export const Building: any;
  export const Tool: any;
  export const Wrench: any;
  export const Package: any;
  export const Layers: any;
  export const Grid: any;
  export const List: any;
  export const Table: any;
  export const Columns: any;
  export const Layout: any;
  export const Sidebar: any;
  export const Bell: any;
  export const BellOff: any;
  export const Volume2: any;
  export const VolumeX: any;
  export const Printer: any;
  export const QrCode: any;
  export const Barcode: any;
  export const Hash: any;
  export const AtSign: any;
  export const Link: any;
  export const Paperclip: any;
  export const FileDown: any;
  export const FileUp: any;
  export const FolderOpen: any;
  export const Folder: any;
  export const HardDrive: any;
  export const Server: any;
  export const Cloud: any;
  export const CloudOff: any;
  export const CloudUpload: any;
  export const CloudDownload: any;
  export const Github: any;
  export const ArrowRight: any;
  export const ArrowLeft: any;
  export const ArrowUp: any;
  export const ArrowDown: any;
  export const RotateCcw: any;
  export const RotateCw: any;
  export const Maximize: any;
  export const Minimize: any;
  export const ZoomIn: any;
  export const ZoomOut: any;
  export const Move: any;
  export const Crosshair: any;
  export const Target: any;
  export const AlertTriangle: any;
  export const HelpCircle: any;
  export const Sliders: any;
  export const Toggle: any;
  export const ToggleLeft: any;
  export const ToggleRight: any;
  export const Switch: any;
  export const Radio: any;
  export const CheckSquare: any;
  export const Square: any;
  export const Circle: any;
  export const Minus: any;
  export const Bold: any;
  export const Italic: any;
  export const Underline: any;
  export const AlignLeft: any;
  export const AlignCenter: any;
  export const AlignRight: any;
  export const Type: any;
  export const Palette: any;
  export const Brush: any;
  export const Crop: any;
  export const Scissors: any;
  export const Terminal: any;
  export const Code: any;
  export const Code2: any;
}
declare module 'xlsx' {
  export const utils: any;
  export function write(wb: any, opts: any): any;
  export function writeFile(wb: any, filename: string): void;
  export const version: string;
}
declare module 'html2canvas' {
  const html2canvas: any;
  export default html2canvas;
}
declare module '*.css' {
  const content: any;
  export default content;
}
declare module '@tailwindcss/vite' {
  const plugin: any;
  export default plugin;
}
declare module '@vitejs/plugin-react' {
  const plugin: any;
  export default plugin;
}
