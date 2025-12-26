import tkinter as tk
from tkinter import font as tkfont
import math

class Calculator:
    def __init__(self, root):
        self.root = root
        self.root.title("Calculator")
        self.root.geometry("320x500")
        self.root.configure(bg="#202020")
        
        # Variable to store current expression
        self.expression = ""
        self.equation = tk.StringVar()
        self.result_shown = False

        # Custom Fonts
        self.display_font = tkfont.Font(family="Segoe UI", size=40, weight="bold")
        self.button_font = tkfont.Font(family="Segoe UI", size=14)
        self.small_button_font = tkfont.Font(family="Segoe UI", size=12)

        self.create_display()
        self.create_buttons()
        self.create_bindings()

    def create_display(self):
        # Display Frame
        display_frame = tk.Frame(self.root, bg="#202020", height=100)
        display_frame.pack(expand=True, fill="both")

        # Label for the expression/result
        self.label = tk.Label(
            display_frame, 
            textvariable=self.equation, 
            anchor="e", 
            bg="#202020", 
            fg="white", 
            padx=20, 
            font=self.display_font
        )
        self.label.pack(expand=True, fill="both", side="bottom")
        self.equation.set("0")

    def create_buttons(self):
        # Button layout configuration
        buttons_frame = tk.Frame(self.root, bg="#202020")
        buttons_frame.pack(expand=True, fill="both")

        # Grid configuration
        for i in range(6):
            buttons_frame.rowconfigure(i, weight=1)
        for i in range(4):
            buttons_frame.columnconfigure(i, weight=1)

        # Button definitions (text, row, col, function, style_type)
        # Styles: 0=Number/Dot (Black/DarkGrey), 1=Operator (Grey), 2=Equals (Blue/Accent)
        buttons = [
            ('%', 0, 0, lambda: self.on_operation('%'), 1),
            ('CE', 0, 1, self.clear_entry, 1),
            ('C', 0, 2, self.clear_all, 1),
            ('⌫', 0, 3, self.backspace, 1),

            ('1/x', 1, 0, lambda: self.on_unary('reciprocal'), 1),
            ('x²', 1, 1, lambda: self.on_unary('square'), 1),
            ('√x', 1, 2, lambda: self.on_unary('sqrt'), 1),
            ('÷', 1, 3, lambda: self.on_operation('/'), 1),

            ('7', 2, 0, lambda: self.add_digit('7'), 0),
            ('8', 2, 1, lambda: self.add_digit('8'), 0),
            ('9', 2, 2, lambda: self.add_digit('9'), 0),
            ('×', 2, 3, lambda: self.on_operation('*'), 1),

            ('4', 3, 0, lambda: self.add_digit('4'), 0),
            ('5', 3, 1, lambda: self.add_digit('5'), 0),
            ('6', 3, 2, lambda: self.add_digit('6'), 0),
            ('-', 3, 3, lambda: self.on_operation('-'), 1),

            ('1', 4, 0, lambda: self.add_digit('1'), 0),
            ('2', 4, 1, lambda: self.add_digit('2'), 0),
            ('3', 4, 2, lambda: self.add_digit('3'), 0),
            ('+', 4, 3, lambda: self.on_operation('+'), 1),

            ('+/-', 5, 0, self.negate, 0),
            ('0', 5, 1, lambda: self.add_digit('0'), 0),
            ('.', 5, 2, self.add_decimal, 0),
            ('=', 5, 3, self.calculate, 2),
        ]

        for text, row, col, command, style in buttons:
            btn = tk.Button(
                buttons_frame, 
                text=text, 
                command=command, 
                borderwidth=0,
                font=self.button_font if style != 1 else self.small_button_font
            )
            
            # Styling based on type
            if style == 0: # Numbers
                bg_color = "#3b3b3b"
                hover_color = "#323232"
                fg_color = "white"
            elif style == 1: # Operators/Functions
                bg_color = "#323232"
                hover_color = "#3b3b3b"
                fg_color = "white"
            else: # Equals
                bg_color = "#76b9ed" # Windows blue-ish
                hover_color = "#66aadd"
                fg_color = "black"

            btn.configure(bg=bg_color, fg=fg_color, activebackground=hover_color, activeforeground=fg_color)
            btn.grid(row=row, column=col, sticky="nsew", padx=1, pady=1)

            # Hover effects
            def on_enter(e, bg=hover_color):
                e.widget['background'] = bg
            def on_leave(e, bg=bg_color):
                e.widget['background'] = bg
            
            btn.bind("<Enter>", on_enter)
            btn.bind("<Leave>", on_leave)

    def create_bindings(self):
        self.root.bind('<Return>', lambda e: self.calculate())
        self.root.bind('<BackSpace>', lambda e: self.backspace())
        self.root.bind('<Escape>', lambda e: self.clear_all())
        for key in '0123456789':
            self.root.bind(key, lambda e, k=key: self.add_digit(k))
        self.root.bind('.', lambda e: self.add_decimal())
        self.root.bind('+', lambda e: self.on_operation('+'))
        self.root.bind('-', lambda e: self.on_operation('-'))
        self.root.bind('*', lambda e: self.on_operation('*'))
        self.root.bind('/', lambda e: self.on_operation('/'))

    def format_result(self, value):
        """Format result to fit display with appropriate rounding"""
        if isinstance(value, (int, float)):
            # If it's an integer or has no decimal part, show as integer
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            
            # For very large or very small numbers, use scientific notation
            if abs(value) >= 1e10 or (abs(value) < 1e-4 and value != 0):
                formatted = f"{value:.6e}"
                return formatted
            
            # For regular numbers, limit to 10 significant figures
            # This ensures it fits nicely on the display
            str_val = str(value)
            if len(str_val) > 12:  # Limit display length
                # Round to 10 decimal places
                formatted = f"{value:.10g}"
                return formatted
            
            return str_val
        return str(value)

    def add_digit(self, digit):
        if self.result_shown:
            self.expression = digit
            self.result_shown = False
        else:
            if self.expression == "0":
                self.expression = digit
            else:
                self.expression += digit
        self.equation.set(self.expression)

    def add_decimal(self):
        if self.result_shown:
            self.expression = "0."
            self.result_shown = False
        elif "." not in self.expression.split()[-1] if self.expression else True:
             self.expression += "."
        self.equation.set(self.expression)

    def on_operation(self, operator):
        if self.result_shown:
            self.result_shown = False
        
        # If last char is operator, replace it
        if self.expression and self.expression[-1] in "+-*/":
            self.expression = self.expression[:-1] + operator
        else:
            self.expression += operator
        self.equation.set(self.expression)

    def on_unary(self, operation):
        try:
            val = float(eval(self.expression))
            if operation == 'reciprocal':
                if val == 0:
                    self.equation.set("Cannot divide by zero")
                    self.expression = ""
                    self.result_shown = True
                    return
                res = 1 / val
            elif operation == 'square':
                res = val ** 2
            elif operation == 'sqrt':
                if val < 0:
                    self.equation.set("Invalid Input")
                    self.expression = ""
                    self.result_shown = True
                    return
                res = math.sqrt(val)
            
            # Format result to fit display
            self.expression = self.format_result(res)
            self.equation.set(self.expression)
            self.result_shown = True
        except Exception:
            self.equation.set("Error")
            self.expression = ""
            self.result_shown = True

    def negate(self):
        if self.expression:
            try:
                # Simple negation for current number logic could be complex with full expression
                # For simplicity, we'll just evaluate and negate
                val = float(eval(self.expression))
                val = -val
                self.expression = self.format_result(val)
                self.equation.set(self.expression)
            except:
                pass

    def clear_entry(self):
        # Clears the last entry (number)
        # Simplified: just clear all for now or implement complex parsing
        self.expression = "0"
        self.equation.set(self.expression)

    def clear_all(self):
        self.expression = "0"
        self.equation.set(self.expression)
        self.result_shown = False

    def backspace(self):
        if self.result_shown:
            self.expression = "0"
            self.result_shown = False
        else:
            self.expression = self.expression[:-1]
            if not self.expression:
                self.expression = "0"
        self.equation.set(self.expression)

    def calculate(self):
        try:
            # Replace visual operators with python ones
            # Note: we are already using python operators internally for the most part
            # but let's be safe
            safe_expr = self.expression.replace('×', '*').replace('÷', '/')
            
            # Eval is dangerous in general but okay for a local calculator app
            result = eval(safe_expr)
            
            # Format result to fit display
            self.expression = self.format_result(result)
            self.equation.set(self.expression)
            self.result_shown = True
        except ZeroDivisionError:
            self.equation.set("Cannot divide by zero")
            self.expression = ""
            self.result_shown = True
        except Exception:
            self.equation.set("Error")
            self.expression = ""
            self.result_shown = True

if __name__ == "__main__":
    root = tk.Tk()
    app = Calculator(root)
    root.mainloop()
