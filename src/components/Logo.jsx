import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img className="h-6 w-6 object-contain min-[400px]:h-8 min-[400px]:w-8" src={logo} alt="" />
      <span className="whitespace-nowrap font-display text-sm font-bold text-navy-950 min-[400px]:text-lg">
       <Link className="shrink-0" to="/">Bot(s) KZ</Link>
      </span>
     
    </div>
    
  );
}
