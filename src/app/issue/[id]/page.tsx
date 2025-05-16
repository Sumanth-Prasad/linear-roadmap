// This is a Server Component that uses Client Components
import React from "react";
import { getLinearClient, safeGraphQLQuery } from "@/lib/linear";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { LinearInput } from "@/components/linear-input";
import { LinearLabel } from "@/components/linear-label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CommentForm } from "@/components/comment-form";
import { updateIssue, updateIssueAndRedirect, deleteIssueAndRedirect } from "@/app/actions";

// Define params type for this specific route
type IssueParams = {
  id: string;
};

async function fetchIssueDetails(issueId: string) {
  const client = getLinearClient();
  try {
    const issue = await client.issue(issueId);
    const comments = await issue.comments();
    
    // Fetch state and assignee info
    const stateObj = issue.state ? await issue.state : null;
    const assigneeObj = issue.assignee ? await issue.assignee : null;
    const teamObj = issue.team ? await issue.team : null;
    
    // Fetch customer requests associated with this issue
    const customerNeedsQuery = `
      query GetCustomerNeeds($issueId: ID!) {
        customerNeeds(
          filter: { issue: { id: { eq: $issueId } } }
        ) {
          nodes {
            id
            body
            createdAt
            customer {
              id
              name
              domains
            }
            attachment {
              url
              title
            }
          }
        }
      }
    `;

    const customerNeedsData = await safeGraphQLQuery<{ 
      customerNeeds?: {
        nodes: Array<{
          id: string;
          body: string;
          createdAt: string;
          customer?: {
            id: string;
            name: string;
            domains?: string[];
          } | null;
          attachment?: {
            url: string;
            title?: string;
          } | null;
        }>;
      };
    }>(
      client,
      customerNeedsQuery,
      { issueId },
      { customerNeeds: { nodes: [] } }
    );
    
    // Processing customer needs data
    const customerNeeds = customerNeedsData?.customerNeeds?.nodes || [];
    
    // Fetch all comment users in parallel
    const commentsWithUsers = await Promise.all(
      comments.nodes.map(async (comment) => {
        let userName = "Unknown";
        let avatarUrl: string | undefined = undefined;
        
        if (comment.user) {
          const userObj = await comment.user;
          userName = userObj?.name || "Unknown";
          avatarUrl = userObj?.avatarUrl || undefined;
        }
        
        return {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          user: { 
            name: userName,
            avatarUrl
          }
        };
      })
    );
    
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      state: stateObj ? {
        id: stateObj.id,
        name: stateObj.name,
        color: stateObj.color
      } : null,
      assignee: assigneeObj ? {
        id: assigneeObj.id,
        name: assigneeObj.name,
        avatarUrl: assigneeObj.avatarUrl
      } : null,
      team: teamObj ? {
        id: teamObj.id,
        name: teamObj.name,
        key: teamObj.key
      } : null,
      priority: issue.priority,
      comments: commentsWithUsers,
      customerNeeds,
      updatedAt: issue.updatedAt,
      createdAt: issue.createdAt
    };
  } catch (error) {
    console.error("Error fetching issue details:", error);
    return null;
  }
}

export default async function IssueDetailsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<IssueParams> | IssueParams;
  searchParams: { edit?: string };
}) {
  // Await params before accessing properties (Next.js 15+ requirement)
  const routeParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const issue = await fetchIssueDetails(routeParams.id);
  const isEditMode = resolvedSearchParams.edit === "true";
  
  if (!issue) {
    return (
      <main className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-[50vh]">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-bold mb-4">Issue Not Found</h2>
            <p className="text-muted-foreground mb-6">This issue may have been deleted or you don&apos;t have permission to view it.</p>
            <Link href="/roadmap">
              <Button variant="default">
                Return to Roadmap
              </Button>
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto bg-background text-foreground">
      <div className="mb-4 sm:mb-6">
        <Link href="/roadmap" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 group">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-1">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Roadmap
        </Link>
      </div>
      
      <Card className="p-4 sm:p-5 md:p-6 mb-6 shadow-md overflow-hidden">
        {isEditMode ? (
          <form action={updateIssueAndRedirect} className="space-y-5 w-full">
            <input type="hidden" name="issueId" value={issue.id} />
            
            <div>
              <LinearLabel htmlFor="title" className="mb-1.5 block text-sm">Issue Title</LinearLabel>
              <LinearInput 
                id="title" 
                name="title" 
                defaultValue={issue.title}
                required
                placeholder="Issue title"
                className="text-lg sm:text-xl font-semibold"
              />
            </div>
            
            <div>
              <LinearLabel htmlFor="description" className="mb-1.5 block text-sm">Description (Markdown)</LinearLabel>
              <textarea 
                id="description" 
                name="description" 
                defaultValue={issue.description || ""}
                className="w-full min-h-[250px] sm:min-h-[300px] p-3 text-sm bg-muted/30 dark:bg-muted/20 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background font-mono rounded-md border border-border"
                placeholder="Describe the issue in detail..."
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                Markdown supported
              </div>
            </div>
            
            <div className="flex justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
              <Button asChild variant="outline" size="sm">
                <Link href={`/issue/${issue.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" size="sm" className="px-4">
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-4">
              <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight mb-1.5">{issue.title}</h1>
              <div className="flex gap-2 flex-shrink-0 mt-1 sm:mt-0">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/issue/${issue.id}?edit=true`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                  </Link>
                </Button>
                <form action={deleteIssueAndRedirect.bind(null, issue.id)}>
                  <Button variant="destructive" size="sm" type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete
                  </Button>
                </form>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
              {issue.state && (
                <Badge
                  className="px-2 py-0.5 text-xs font-medium border-0 rounded-full"
                  style={{ backgroundColor: issue.state.color || 'hsl(var(--muted))' , color: 'white'}}
                >
                  {issue.state.name}
                </Badge>
              )}
              
              {issue.priority !== null && issue.priority !== undefined && (
                <Badge
                  className="px-2 py-0.5 text-xs font-medium border-0 text-primary-foreground rounded-full"
                  style={{
                    backgroundColor: 
                      issue.priority === 1 ? "hsl(var(--destructive))" : 
                      issue.priority === 2 ? "hsl(var(--orange-500, #f97316))" : 
                      issue.priority === 3 ? "hsl(var(--yellow-500, #eab308))" : 
                      issue.priority === 4 ? "hsl(var(--muted))" :
                      "hsl(var(--stone-400, #a8a29e))"
                  }}
                >
                  {issue.priority === 1 ? "Urgent" : 
                   issue.priority === 2 ? "High" : 
                   issue.priority === 3 ? "Medium" : 
                   issue.priority === 4 ? "Low" : "No Priority"}
                </Badge>
              )}
              
              {issue.assignee && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-xs font-medium rounded-full flex items-center">
                   <Avatar className="h-4 w-4 mr-1.5">
                    {issue.assignee.avatarUrl ? (
                      <AvatarImage src={issue.assignee.avatarUrl} alt={issue.assignee.name} />
                    ) : (
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {issue.assignee.name.charAt(0)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {issue.assignee.name}
                </Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
              <span>Created: {new Date(issue.createdAt).toLocaleDateString()}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>Updated: {new Date(issue.updatedAt).toLocaleDateString()}</span>
            </div>
            
            <Separator className="mb-2 bg-border/70" />
            
            {issue.description ? (
              <div className="mb-6 pb-2">
                <MarkdownRenderer content={issue.description} className="text-sm" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic mb-6 p-5 bg-muted/30 dark:bg-muted/20 rounded-md border border-dashed border-border text-center">
                No description provided.
              </div>
            )}
            
            {issue.customerNeeds && issue.customerNeeds.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  Customer Requests 
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{issue.customerNeeds.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {issue.customerNeeds.map(request => (
                    <Card key={request.id} className="overflow-hidden shadow-sm">
                      <div className="flex justify-between items-center p-3 border-b border-border bg-muted/30 dark:bg-muted/20">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                              {request.customer?.name?.charAt(0).toUpperCase() || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-foreground">
                              {request.customer?.name || 'Unknown Customer'}
                              {request.customer?.domains && request.customer.domains.length > 0 && (
                                <span className="ml-1.5 text-xs text-primary/90">
                                  ({request.customer.domains[0]})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(request.createdAt).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 text-sm">
                        <MarkdownRenderer content={request.body} />
                        {request.attachment && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <a href={request.attachment.url} target="_blank" rel="noopener noreferrer" 
                               className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 group">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-y-px">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                              </svg>
                              {request.attachment.title || "View original conversation"}
                            </a>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
          Comments 
          {issue.comments.length > 0 && 
            <Badge variant="default" className="h-6 min-w-6 px-1 flex justify-center items-center text-sm rounded-full">
              {issue.comments.length}
            </Badge>
          }
        </h2>
        {issue.comments.length > 0 ? (
          <div className="space-y-4 mb-6">
          {issue.comments.map(comment => (
              <Card key={comment.id} className="overflow-hidden shadow-sm">
                <div className="flex justify-between items-center p-3 border-b border-border bg-muted/30 dark:bg-muted/20">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      {comment.user?.avatarUrl ? (
                        <AvatarImage src={comment.user.avatarUrl} alt={comment.user.name || 'User'} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                          {(comment.user?.name?.charAt(0) || 'U').toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm text-foreground">{comment.user?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 text-sm">
                  <MarkdownRenderer content={comment.body} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
          <Card className="p-6 border border-dashed border-border/70 mb-6 flex flex-col items-center justify-center text-center bg-card min-h-[100px]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-muted-foreground/70">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts!</p>
          </Card>
        )}
        
        <div className="mt-6 pt-5 border-t border-border">
          <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            Add a comment
          </h3>
          <CommentForm issueId={issue.id} />
        </div>
      </div>
    </main>
  );
}