import { PageHeader } from "@/components/common/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Coffee,
  Heart,
  Github,
  ExternalLink,
  Star,
  Share2,
  Code,
  Users,
} from "lucide-react";
import { appConfig } from "@/lib/app-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ElectronLink } from "../electron-hyperlink";

export default function DonatePage() {
 

  return (
    <div className="container mx-auto space-y-8 pb-12">
      <PageHeader
        title="Support Social Saver"
        description="Help fund ongoing development and server costs"
      >
        <div className="flex items-center justify-center mt-2">
          <Heart className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-muted-foreground">
            Every contribution makes a difference - thank you!
          </span>
        </div>
      </PageHeader>

      <Tabs defaultValue="donate" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="donate">Donation Options</TabsTrigger>
          <TabsTrigger value="about">About & Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="donate" className="space-y-6">
          <div className="grid gap-6 grid-cols-2 xl:grid-cols-2">
            <Card className="flex flex-col border-primary/20 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center">
                    <Coffee className="h-5 w-5 mr-2 text-amber-500" />
                    Buy Me a Coffee
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-200"
                  >
                    Popular
                  </Badge>
                </div>
                <CardDescription>Quick one-time support</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  A small donation helps cover development costs and server
                  expenses while I balance college studies.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md"
                  asChild
                >
                  <ElectronLink
                    href={appConfig.donation.buyMeACoffee}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    Buy Me a Coffee
                  </ElectronLink>
                </Button>
              </CardFooter>
            </Card>

        

            <Card className="flex flex-col border-primary/20 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center">
                    <Github className="h-5 w-5 mr-2" />
                    GitHub Sponsor
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    Recurring
                  </Badge>
                </div>
                <CardDescription>Ongoing monthly support</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Become a GitHub sponsor for as little as $1/month and receive
                  exclusive updates and early access to new features.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md"
                  asChild
                >
                  <ElectronLink
                    href={appConfig.donation.githubSponsor}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <Heart className="h-4 w-4 mr-2 text-red-500" />
                    Become a Sponsor
                  </ElectronLink>
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="rounded-lg border p-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Other Ways to Help</h3>
            <p className="text-muted-foreground mb-4">
              Can't donate financially? You can still support this project in
              valuable ways:
            </p>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Button variant="outline" className="h-auto py-3" asChild>
                <ElectronLink
                  href={appConfig.githubRepo + "/stargazers"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center"
                >
                  <Star className="h-5 w-5 mb-1 text-yellow-500" />
                  <span>Star on GitHub</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Show your appreciation
                  </span>
                </ElectronLink>
              </Button>
              <Button variant="outline" className="h-auto py-3" asChild>
                <ElectronLink
                  href={appConfig.githubRepo + "/issues"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center"
                >
                  <ExternalLink className="h-5 w-5 mb-1 text-blue-500" />
                  <span>Report Issues</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Help improve quality
                  </span>
                </ElectronLink>
              </Button>
              <Button variant="outline" className="h-auto py-3" asChild>
                <ElectronLink
                  href={appConfig.githubRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center"
                >
                  <Code className="h-5 w-5 mb-1 text-green-500" />
                  <span>Contribute Code</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Submit a pull request
                  </span>
                </ElectronLink>
              </Button>
              <Button variant="outline" className="h-auto py-3" asChild>
                <ElectronLink
                  href={appConfig.social.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center"
                >
                  <Share2 className="h-5 w-5 mb-1 text-primary" />
                  <span>Share With Others</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Spread the word
                  </span>
                </ElectronLink>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2 text-primary" />
                About the Developer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src="/vishal-kaleria.jpg"
                    className="w-full h-full flex items-center justify-center object-cover bg-primary/10 text-primary font-medium"
                  />{" "}
                </div>
                <div className="flex-grow space-y-3 text-center md:text-left">
                  <h3 className="text-lg font-medium">{appConfig.author}</h3>
                  <p className="text-sm text-muted-foreground">
                    I'm a first-year BCA student and the solo developer of
                    Social Saver—an all-in-one social media downloader built
                    from the ground up. What started as a small utility evolved
                    into a full-featured, cross-platform app supporting Windows,
                    macOS, and Linux.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Social Saver supports batch downloading, quality and format
                    selection, cookies/session support, audio-only extraction,
                    thumbnail and metadata saving, and even merges audio/video
                    streams—all wrapped in a proper binary-managed app for all
                    desktop platforms.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    I created this using my own effort and time, without
                    external funding or a team. Donations help keep the project
                    alive, cover server maintenance, fix bugs faster, and allow
                    me to eventually bring it to Android and iOS as well.
                  </p>
                  <div className="flex gap-2 justify-center md:justify-start">
                    <Button variant="outline" size="sm" asChild>
                      <ElectronLink
                        href={appConfig.social.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Twitter
                      </ElectronLink>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <ElectronLink
                        href={appConfig.social.github}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        GitHub
                      </ElectronLink>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <ElectronLink
                        href={appConfig.social.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LinkedIn
                      </ElectronLink>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Where Your Support Goes</CardTitle>
              <CardDescription>
                Supporting this project helps keep it alive and growing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Every contribution goes directly into keeping Social Saver
                  running and evolving. Whether it's covering server
                  infrastructure, maintaining download scripts, pushing updates,
                  or preparing for mobile development—your support fuels it all.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Maintain and improve cross-platform compatibility</li>
                  <li>
                    Fix bugs and update download logic for supported platforms
                  </li>
                  <li>Expand platform support based on user demand</li>
                  <li>Optimize performance and handle edge-case downloads</li>
                  <li>Develop native mobile versions for Android and iOS</li>
                </ul>
                <p>
                  If you find Social Saver useful, consider supporting to help
                  me keep this free and polished for everyone.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="faq-1">
                  <AccordionTrigger>Is Social Saver free?</AccordionTrigger>
                  <AccordionContent>
                    Yes, Social Saver is completely free to use. All the core
                    features are open to everyone. Donations are optional but
                    appreciated.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-2">
                  <AccordionTrigger>
                    Which platforms are supported?
                  </AccordionTrigger>
                  <AccordionContent>
                    Social Saver is available for Windows, macOS, and Linux—with
                    native binaries for each. Mobile (Android/iOS) is planned in
                    the future.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-3">
                  <AccordionTrigger>
                    Can I download audio only?
                  </AccordionTrigger>
                  <AccordionContent>
                    Absolutely! The app lets you extract audio-only streams,
                    supports merging audio/video when needed, and offers
                    multiple quality options.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-4">
                  <AccordionTrigger>
                    How do I suggest a new feature or report a bug?
                  </AccordionTrigger>
                  <AccordionContent>
                    You can open an issue on the GitHub repository or contact me
                    through any of the social links. I review all suggestions
                    and prioritize based on impact and feasibility.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-5">
                  <AccordionTrigger>
                    Do donations unlock premium features?
                  </AccordionTrigger>
                  <AccordionContent>
                    No, there are no locked features. Donations are just to
                    support ongoing development, hosting, and updates. Everyone
                    gets the same powerful app.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
