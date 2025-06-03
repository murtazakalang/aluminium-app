{\rtf1\ansi\ansicpg1252\cocoartf2821
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 Important Rules AI Must Follow:\
\
1. Code Structure:\
- Keep backend and frontend folders cleanly separated.\
- Follow MVC (Model View Controller) architecture on backend.\
\
2. Naming Conventions:\
- Use clear, meaningful variable and function names.\
- Always use camelCase for variables and snake_case for database fields.\
\
3. Error Handling:\
- Proper try/catch blocks for all async functions.\
- Proper HTTP status codes (200, 400, 401, 404, 500).\
\
4. API Design:\
- RESTful APIs: Separate routes for GET, POST, PUT, DELETE.\
- Use pagination for listing endpoints.\
\
5. Frontend Rules:\
- Responsive mobile-first design (TailwindCSS preferred if styling needed).\
- Consistent UI components across pages.\
\
6. Database Rules:\
- Use Mongoose schema validations.\
- Index fields that are searched frequently (like client name, window code).\
\
7. Subscription and Billing:\
- Protect subscription-only routes (middleware authentication).\
- Alert users before subscription expiry.\
\
8. Code Quality:\
- DRY (Don't Repeat Yourself) principle.\
- Modular, reusable code wherever possible.\
\
9. Progress Tracking:\
- After completing each phase, mark it "done" before starting the next.\
\
10. Documentation:\
- Every model, route, and major function should have a short comment explaining it.\
}