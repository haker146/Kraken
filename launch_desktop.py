import os
import sys
import win32event
import win32process

if __name__ == "__main__":
    work_dir = os.path.dirname(os.path.abspath(__file__))
    main_gui = os.path.join(work_dir, "Main_gui.py")
    python_exe = sys.executable

    si = win32process.STARTUPINFO()
    si.lpDesktop = r"WinSta0\Default"

    cmd = f'"{python_exe}" "{main_gui}"'
    hProcess, hThread, pid, tid = win32process.CreateProcess(
        None,
        cmd,
        None,
        None,
        False,
        0,
        None,
        work_dir,
        si,
    )
    print(f"Kraken GUI running on interactive desktop (PID: {pid})")
    win32event.WaitForSingleObject(hProcess, win32event.INFINITE)
