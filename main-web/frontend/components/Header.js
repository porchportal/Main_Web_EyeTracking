export default function Header() {
  // Only NEXT_PUBLIC_ variables are accessible on the client side
  const appName = process.env.NEXT_PUBLIC_APP_NAME;
  
  return (
    <header className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold">{appName}</h1>
      </div>
    </header>
  );
}