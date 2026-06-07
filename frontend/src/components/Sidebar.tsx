import {NavLink} from 'react-router-dom';



function Sidebar() {
    const linkClass = ({isActive}: {isActive: boolean}) => {
          return `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
            isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
        }`;
    }


    return (
        <aside className="w-64 bg-zinc-950 border-r border-zinc-800 p-4 flex flex-col gap-2">
            <NavLink to="/" className={linkClass}>
                <span>Home</span>
            </NavLink>
            <NavLink to="/search" className={linkClass}>
                <span>Search</span>
            </NavLink>
            <NavLink to="/library" className={linkClass}>
                <span>Library</span>
            </NavLink>

        </aside>
    );
}

export default Sidebar;