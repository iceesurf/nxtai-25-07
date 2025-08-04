import React, { useState } from 'react';
import { auth } from './firebaseConfig'; // Import your Firebase auth instance
import { signInWithEmailAndPassword } from "firebase/auth";

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Signed in 
      const user = userCredential.user;
      setSuccess(`Login successful! Welcome ${user.email}`);
      console.log('User signed in:', user);
      // Here you can redirect the user or update the UI
      
    } catch (err) {
      // Handle errors here.
      setError(err.message); // Display a more user-friendly error message
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
