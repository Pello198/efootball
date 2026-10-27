Football Tournament Manager
A full-stack web application designed to organize, manage, and track eFootball tournaments. 
It features automated group-stage and knockout-stage fixture generation, real-time standings calculations, player profile tracking, match screenshot proofs, WhatsApp integration, and admin override tools.
Live Frontend (Netlify): [https://matchcontrols.netlify.app/]   
Backend API (Render): [https://efootball-87pw.onrender.com]
Tech StackFrontend: HTML5, CSS3, Vanilla JavaScript (ES Modules), Vite   Backend: Node.js, Express.js, JWT Authentication, Multer (for image/screenshot uploads)   Database: Aiven MySQL (tournament database) with SSL configuration 
Key FeaturesUser Authentication: Secure JWT-based login and registration system supporting optional avatar profile pictures and WhatsApp contact numbers.  
Tournament Lifecycle Management: Create tournaments with custom player limits, register players, and automatically seed group-stage fixtures upon starting.  
Interactive Fixtures & Standings:Group stage round-robin management with dynamic point tables (Wins, Draws, Losses, Goals For/Against, Goal Difference).  
Automated  advancement to Knockout stages (Quarterfinals, Semifinals, Finals) with penalty tie-breaker handling.  
Match Results & Verification: Players or admins can submit match scores along with optional screenshot proof viewable via a fullscreen modal viewer.
Player Profiles: Comprehensive career stats, head-to-head match history across multiple tournaments, and direct WhatsApp chat links (wa.me) for scheduling matches.  
Admin Tools: Role-based permissions allowing admins to delete tournaments/players, override match scores, and track correction history logs.

Local Development Setup1. Clone the RepositoryBashgit clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
cd YOUR_REPOSITORY_NAME
2. Configure Environment VariablesCreate a .env file in your root backend directory:Code snippetPORT=3000
DB_HOST=your-aiven-mysql-host.aivencloud.com
DB_USER=avnadmin
DB_PASSWORD=your_database_password
DB_NAME=tournament
DB_PORT=your_port_number
JWT_SECRET=your_jwt_secret_key
3. Run the Backend ServerBashnpm install
node server.js
(The backend automatically seeds an admin user on startup if it doesn't already exist). 
4. Run the Frontend Development ServerBashcd public
npm install
npm run dev
