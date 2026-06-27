@@ .. @@
       <p className="text-gray-300 mb-8">
-      <p className="text-text-secondary mb-8">
         Configure your deployment settings for the {architecture.provider.toUpperCase()} architecture.
       </p>
@@ .. @@
         <div className="space-y-6">
           <div>
-            <label htmlFor="region" className="block text-sm font-medium text-gray-300 mb-2">
+            <label htmlFor="region" className="block text-sm font-medium text-text-secondary mb-2">
               Region
             </label>
             <select
@@ .. @@
             </select>
-            <p className="mt-2 text-sm text-gray-500">
+            <p className="mt-2 text-sm text-text-tertiary">
               Select the region where you want to deploy your resources.
             </p>
           </div>
           
           <div>
-            <label htmlFor="github" className="block text-sm font-medium text-gray-300 mb-2">
+            <label htmlFor="github" className="block text-sm font-medium text-text-secondary mb-2">
               GitHub Repository (Optional)
             </label>
             <div className="flex items-center space-x-2">
-              <div className="bg-gray-800 border border-gray-700 rounded-l-lg px-3 py-2 text-gray-400">
+              <div className="bg-background-secondary border border-border-secondary rounded-l-lg px-3 py-2 text-text-tertiary">
                 <Github className="w-5 h-5" />
               </div>
               <input
@@ .. @@
               />
             </div>
-            <p className="mt-2 text-sm text-gray-500">
+            <p className="mt-2 text-sm text-text-tertiary">
               The generated infrastructure code will be committed to this repository.
             </p>
           </div>
           
-         <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/30">
+          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
             <div className="flex items-center space-x-2 mb-2">
               <GitBranch className="w-5 h-5 component-text-accent" />
-              <h4 className="font-medium">Deployment Steps</h4>
+              <h4 className="font-medium text-text-primary">Deployment Steps</h4>
             </div>
-            <ul className="space-y-2 text-sm text-gray-300">
+            <ul className="space-y-2 text-sm text-text-secondary">
               <li className="flex items-start space-x-2">
                 <span className="text-blue-400 text-lg">•</span>
                 <span>The infrastructure code will be generated based on your architecture</span>